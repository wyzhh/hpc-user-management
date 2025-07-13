import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Admin, AdminConfig } from '../types';
import pool from '../config/database';

export class AdminConfigService {
  private configPath: string;
  private adminsCache: AdminConfig[] | null = null;
  private lastLoadTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1分钟缓存

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(__dirname, '../../config/admins.yaml');
  }

  // 加载管理员配置
  async loadAdminConfig(): Promise<AdminConfig[]> {
    const now = Date.now();
    
    // 检查缓存
    if (this.adminsCache && (now - this.lastLoadTime) < this.CACHE_TTL) {
      return this.adminsCache;
    }

    try {
      if (!fs.existsSync(this.configPath)) {
        console.warn(`管理员配置文件不存在: ${this.configPath}`);
        return [];
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.load(configContent) as { admins: AdminConfig[] };
      
      if (!config || !config.admins || !Array.isArray(config.admins)) {
        console.warn('管理员配置文件格式不正确');
        return [];
      }

      // 验证配置
      const validAdmins = config.admins.filter(admin => this.validateAdminConfig(admin));
      
      this.adminsCache = validAdmins;
      this.lastLoadTime = now;
      
      console.log(`加载了 ${validAdmins.length} 个管理员配置`);
      return validAdmins;

    } catch (error) {
      console.error('加载管理员配置失败:', error);
      return [];
    }
  }

  // 验证管理员配置格式
  private validateAdminConfig(admin: any): boolean {
    if (!admin.username || !admin.full_name || !admin.email) {
      console.warn('管理员配置缺少必要字段:', admin);
      return false;
    }

    if (admin.auth_type !== 'ldap') {
      console.warn('管理员必须使用LDAP认证:', admin.auth_type);
      return false;
    }

    if (!['admin', 'super_admin'].includes(admin.role)) {
      console.warn('管理员角色无效:', admin.role);
      return false;
    }

    return true;
  }

  // 同步配置到数据库
  async syncAdminsToDatabase(): Promise<{ 
    created: number; 
    updated: number; 
    errors: string[] 
  }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    try {
      const adminConfigs = await this.loadAdminConfig();
      
      for (const adminConfig of adminConfigs) {
        try {
          const existingAdmin = await this.findAdminByUsername(adminConfig.username);
          
          if (existingAdmin) {
            // 更新现有管理员
            await this.updateAdminFromConfig(existingAdmin.id, adminConfig);
            updated++;
            console.log(`更新管理员: ${adminConfig.username}`);
          } else {
            // 创建新管理员
            await this.createAdminFromConfig(adminConfig);
            created++;
            console.log(`创建管理员: ${adminConfig.username}`);
          }
        } catch (error) {
          const errorMsg = `同步管理员 ${adminConfig.username} 失败: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`管理员同步完成: 创建 ${created}, 更新 ${updated}, 错误 ${errors.length}`);
      return { created, updated, errors };

    } catch (error) {
      const errorMsg = `管理员同步失败: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return { created, updated, errors };
    }
  }

  // 根据用户名查找管理员
  private async findAdminByUsername(username: string): Promise<Admin | null> {
    const query = 'SELECT * FROM admins WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  // 从配置创建管理员
  private async createAdminFromConfig(config: AdminConfig): Promise<Admin> {
    let userId = null;

    // 尝试关联用户
    if (config.uid_number) {
      const userQuery = 'SELECT id FROM users WHERE uid_number = $1';
      const userResult = await pool.query(userQuery, [config.uid_number]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }

    const query = `
      INSERT INTO admins (
        user_id, username, full_name, email, 
        role, auth_type, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      userId,
      config.username,
      config.full_name,
      config.email,
      config.role,
      config.auth_type,
      true
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // 更新管理员
  private async updateAdminFromConfig(adminId: number, config: AdminConfig): Promise<Admin> {
    let userId = null;

    // 尝试关联用户
    if (config.uid_number) {
      const userQuery = 'SELECT id FROM users WHERE uid_number = $1';
      const userResult = await pool.query(userQuery, [config.uid_number]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }

    const query = `
      UPDATE admins SET
        user_id = $2,
        full_name = $3,
        email = $4,
        role = $5,
        auth_type = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      adminId,
      userId,
      config.full_name,
      config.email,
      config.role,
      config.auth_type
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // 获取所有管理员
  async getAllAdmins(): Promise<Admin[]> {
    const query = `
      SELECT 
        a.*,
        u.username as user_username,
        u.full_name as user_full_name
      FROM admins a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.role DESC, a.username
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  // 检查管理员权限
  async checkAdminPermission(username: string, permission: string): Promise<boolean> {
    try {
      const adminConfigs = await this.loadAdminConfig();
      const adminConfig = adminConfigs.find(config => config.username === username);
      
      if (!adminConfig) {
        return false;
      }

      // super_admin 拥有所有权限
      if (adminConfig.role === 'super_admin') {
        return true;
      }

      // 检查具体权限
      if (adminConfig.permissions && adminConfig.permissions.includes(permission)) {
        return true;
      }

      // 默认admin权限
      const defaultAdminPermissions = [
        'view_users',
        'assign_roles',
        'view_sync_logs',
        'manage_students',
        'view_research_groups'
      ];

      return defaultAdminPermissions.includes(permission);

    } catch (error) {
      console.error('检查管理员权限失败:', error);
      return false;
    }
  }

  // 获取管理员的权限列表
  async getAdminPermissions(username: string): Promise<string[]> {
    try {
      const adminConfigs = await this.loadAdminConfig();
      const adminConfig = adminConfigs.find(config => config.username === username);
      
      if (!adminConfig) {
        return [];
      }

      // super_admin 拥有所有权限
      if (adminConfig.role === 'super_admin') {
        return [
          'view_users',
          'manage_users',
          'assign_roles',
          'import_users',
          'view_sync_logs',
          'manage_admins',
          'manage_students',
          'manage_pis',
          'view_research_groups',
          'manage_research_groups',
          'system_settings'
        ];
      }

      // 返回配置的权限或默认权限
      return adminConfig.permissions || [
        'view_users',
        'assign_roles',
        'view_sync_logs',
        'manage_students',
        'view_research_groups'
      ];

    } catch (error) {
      console.error('获取管理员权限失败:', error);
      return [];
    }
  }


  // 更新最后登录时间
  private async updateLastLogin(adminId: number): Promise<void> {
    const query = 'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
    await pool.query(query, [adminId]);
  }

  // 重新加载配置（清除缓存）
  reloadConfig(): void {
    this.adminsCache = null;
    this.lastLoadTime = 0;
    console.log('管理员配置缓存已清除');
  }

  // 验证配置文件语法
  async validateConfigFile(): Promise<{ 
    isValid: boolean; 
    errors: string[]; 
    warnings: string[] 
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!fs.existsSync(this.configPath)) {
        errors.push(`配置文件不存在: ${this.configPath}`);
        return { isValid: false, errors, warnings };
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.load(configContent) as any;

      if (!config) {
        errors.push('配置文件为空或格式错误');
        return { isValid: false, errors, warnings };
      }

      if (!config.admins || !Array.isArray(config.admins)) {
        errors.push('配置文件缺少admins数组');
        return { isValid: false, errors, warnings };
      }

      // 验证每个管理员配置
      const usernames = new Set();
      const emails = new Set();

      config.admins.forEach((admin: any, index: number) => {
        const prefix = `管理员 ${index + 1}`;

        if (!admin.username) {
          errors.push(`${prefix}: 缺少username字段`);
        } else if (usernames.has(admin.username)) {
          errors.push(`${prefix}: 用户名重复: ${admin.username}`);
        } else {
          usernames.add(admin.username);
        }

        if (!admin.full_name) {
          errors.push(`${prefix}: 缺少full_name字段`);
        }

        if (!admin.email) {
          errors.push(`${prefix}: 缺少email字段`);
        } else if (emails.has(admin.email)) {
          warnings.push(`${prefix}: 邮箱重复: ${admin.email}`);
        } else {
          emails.add(admin.email);
        }

        if (!['ldap', 'local'].includes(admin.auth_type)) {
          errors.push(`${prefix}: auth_type必须是ldap或local`);
        }

        if (!['admin', 'super_admin'].includes(admin.role)) {
          errors.push(`${prefix}: role必须是admin或super_admin`);
        }

        if (admin.auth_type === 'local' && !admin.password) {
          errors.push(`${prefix}: 本地认证管理员必须设置密码`);
        }

        if (admin.auth_type === 'ldap' && !admin.uid_number) {
          warnings.push(`${prefix}: LDAP管理员建议设置uid_number`);
        }
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push(`解析配置文件失败: ${error}`);
      return { isValid: false, errors, warnings };
    }
  }

}

export const adminConfigService = new AdminConfigService();