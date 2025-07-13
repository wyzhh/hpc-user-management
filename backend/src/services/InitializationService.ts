import pool from '../config/database';
import { ldapService } from './ldap';

export interface InitializationStatus {
  isInitialized: boolean;
  databaseExists: boolean;
  hasAdminUsers: boolean;
  message: string;
}

export interface LDAPUser {
  username: string;
  full_name: string;
  email: string;
  uid_number?: number;
  ldap_dn: string;
}

export class InitializationService {
  
  /**
   * 检查系统初始化状态
   */
  static async checkInitializationStatus(): Promise<InitializationStatus> {
    try {
      // 1. 检查数据库表是否存在
      const tablesExist = await this.checkTablesExist();
      
      if (!tablesExist) {
        return {
          isInitialized: false,
          databaseExists: false,
          hasAdminUsers: false,
          message: '数据库表不存在，需要进行首次初始化'
        };
      }

      // 2. 检查是否有管理员用户
      const hasAdmins = await this.checkAdminExists();
      
      if (!hasAdmins) {
        return {
          isInitialized: false,
          databaseExists: true,
          hasAdminUsers: false,
          message: '数据库已存在但缺少管理员用户，需要指定管理员'
        };
      }

      return {
        isInitialized: true,
        databaseExists: true,
        hasAdminUsers: true,
        message: '系统已完成初始化'
      };

    } catch (error) {
      console.error('检查初始化状态失败:', error);
      return {
        isInitialized: false,
        databaseExists: false,
        hasAdminUsers: false,
        message: `系统状态检查失败: ${error}`
      };
    }
  }

  /**
   * 检查必要的数据库表是否存在
   */
  private static async checkTablesExist(): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'admins')
      `;
      
      const result = await pool.query(query);
      const tableCount = parseInt(result.rows[0].table_count);
      
      return tableCount === 2; // users 和 admins 表都必须存在
    } catch (error) {
      console.error('检查数据库表失败:', error);
      return false;
    }
  }

  /**
   * 检查是否存在管理员用户
   */
  private static async checkAdminExists(): Promise<boolean> {
    try {
      const query = 'SELECT COUNT(*) as admin_count FROM admins WHERE is_active = true';
      const result = await pool.query(query);
      const adminCount = parseInt(result.rows[0].admin_count);
      
      return adminCount > 0;
    } catch (error) {
      console.error('检查管理员用户失败:', error);
      return false;
    }
  }

  /**
   * 创建数据库表（如果不存在）
   */
  static async createTables(): Promise<{ success: boolean; message: string }> {
    try {
      // 创建用户表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          ldap_dn VARCHAR(255) UNIQUE,
          username VARCHAR(100) UNIQUE NOT NULL,
          uid_number INTEGER UNIQUE,
          gid_number INTEGER,
          full_name VARCHAR(200) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          home_directory VARCHAR(255),
          login_shell VARCHAR(100) DEFAULT '/bin/bash',
          user_type VARCHAR(20) DEFAULT 'unassigned',
          is_admin BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          is_deleted_from_ldap BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_user_type CHECK (user_type IN ('pi', 'student', 'unassigned'))
        )
      `);

      // 创建管理员表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admins (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          username VARCHAR(100) UNIQUE NOT NULL,
          full_name VARCHAR(200) NOT NULL,
          email VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255),
          role VARCHAR(50) DEFAULT 'admin',
          auth_type VARCHAR(20) DEFAULT 'ldap',
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_admin_role CHECK (role IN ('admin', 'super_admin')),
          CONSTRAINT check_auth_type CHECK (auth_type = 'ldap')
        )
      `);

      // 创建其他必要的表
      await this.createAdditionalTables();

      // 创建索引
      await this.createIndexes();

      console.log('数据库表创建完成');
      return { success: true, message: '数据库表创建成功' };

    } catch (error) {
      console.error('创建数据库表失败:', error);
      return { success: false, message: `创建数据库表失败: ${error}` };
    }
  }

  /**
   * 创建其他必要的表
   */
  private static async createAdditionalTables(): Promise<void> {
    // 创建课题组表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS research_groups (
        id SERIAL PRIMARY KEY,
        gid_number INTEGER UNIQUE,
        group_name VARCHAR(200) NOT NULL,
        description TEXT,
        pi_user_id INTEGER REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建PI表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pis (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id),
        department VARCHAR(200),
        office_location VARCHAR(100),
        research_area TEXT,
        max_students INTEGER DEFAULT 10,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建学生表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id),
        pi_id INTEGER REFERENCES pis(id),
        student_id VARCHAR(50),
        major VARCHAR(100),
        enrollment_year INTEGER,
        degree_level VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        join_date DATE,
        expected_graduation DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_status CHECK (status IN ('active', 'graduated', 'suspended')),
        CONSTRAINT check_degree_level CHECK (degree_level IN ('undergraduate', 'master', 'phd'))
      )
    `);

    // 创建同步日志表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id SERIAL PRIMARY KEY,
        sync_type VARCHAR(20) NOT NULL,
        total_users INTEGER DEFAULT 0,
        new_users INTEGER DEFAULT 0,
        updated_users INTEGER DEFAULT 0,
        deleted_users INTEGER DEFAULT 0,
        errors TEXT,
        performed_by INTEGER,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        duration_seconds INTEGER
      )
    `);
  }

  /**
   * 创建索引
   */
  private static async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_uid_number ON users(uid_number)',
      'CREATE INDEX IF NOT EXISTS idx_users_gid_number ON users(gid_number)',
      'CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type)',
      'CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin)',
      'CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username)',
      'CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active)'
    ];

    for (const indexQuery of indexes) {
      try {
        await pool.query(indexQuery);
      } catch (error) {
        console.warn('创建索引失败:', indexQuery, error);
      }
    }
  }

  /**
   * 获取所有LDAP用户
   */
  static async getAllLDAPUsers(): Promise<LDAPUser[]> {
    try {
      console.log('获取所有LDAP用户...');
      
      // 使用LDAP服务获取所有用户
      const rawUsers = await ldapService.getAllUsersWithPosix();
      
      // 转换字段名以匹配前端期望的格式
      const users = rawUsers.map((user: any) => ({
        username: user.uid,
        full_name: user.displayName || user.cn,
        email: user.mail,
        uid_number: user.uidNumber,
        ldap_dn: user.dn
      }));
      
      console.log(`获取到 ${users.length} 个LDAP用户`);
      return users;

    } catch (error) {
      console.error('获取LDAP用户失败:', error);
      throw new Error(`获取LDAP用户失败: ${error}`);
    }
  }

  /**
   * 从LDAP搜索用户（保留向后兼容）
   */
  static async searchLDAPUsers(searchTerm: string): Promise<LDAPUser[]> {
    // 直接返回所有用户，忽略搜索词
    return this.getAllLDAPUsers();
  }

  /**
   * 设置管理员用户
   */
  static async setAdminUser(username: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. 从LDAP获取用户信息
      const ldapUser = await ldapService.getUserByUsername(username);
      if (!ldapUser) {
        return { success: false, message: `LDAP中找不到用户: ${username}` };
      }

      console.log('从LDAP获取到用户信息:', ldapUser);

      // 2. 检查用户表中是否已存在该用户
      let userId: number;
      const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
      
      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
        console.log(`用户已存在于数据库中: ${username}, ID: ${userId}`);
      } else {
        // 3. 在用户表中创建用户记录
        const userResult = await pool.query(`
          INSERT INTO users (
            ldap_dn, username, uid_number, full_name, email, phone, 
            user_type, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          ldapUser.dn,
          ldapUser.uid,
          ldapUser.uidNumber,
          ldapUser.displayName || ldapUser.cn,
          ldapUser.mail,
          ldapUser.telephoneNumber || null,
          'unassigned',
          true
        ]);
        
        userId = userResult.rows[0].id;
        console.log(`创建新用户: ${username}, ID: ${userId}`);
      }

      // 4. 在管理员表中创建管理员记录
      await pool.query(`
        INSERT INTO admins (
          user_id, username, full_name, email, role, auth_type, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (username) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          auth_type = EXCLUDED.auth_type,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
      `, [
        userId,
        ldapUser.uid,
        ldapUser.displayName || ldapUser.cn,
        ldapUser.mail,
        'admin', // 统一使用admin角色
        'ldap',  // 所有管理员都使用LDAP认证
        true
      ]);

      console.log(`管理员用户设置成功: ${username}`);
      return { 
        success: true, 
        message: `管理员用户 ${ldapUser.displayName || ldapUser.cn} (${username}) 设置成功` 
      };

    } catch (error) {
      console.error('设置管理员用户失败:', error);
      return { 
        success: false, 
        message: `设置管理员用户失败: ${error}` 
      };
    }
  }

  /**
   * 获取当前管理员列表
   */
  static async getAdminUsers(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          a.id,
          a.username,
          a.full_name,
          a.email,
          a.role,
          a.auth_type,
          a.is_active,
          a.last_login,
          a.created_at,
          u.uid_number
        FROM admins a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.is_active = true
        ORDER BY a.created_at
      `;
      
      const result = await pool.query(query);
      return result.rows;
      
    } catch (error) {
      console.error('获取管理员列表失败:', error);
      return [];
    }
  }
}

export const initializationService = new InitializationService();