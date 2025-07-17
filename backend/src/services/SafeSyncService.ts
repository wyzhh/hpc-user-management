// import { SimpleLdapService } from './SimpleLdapService'; // 已删除
import { ldapService } from './ldap';
import { UserModel } from '../models/User';
import { AuditService } from './audit';
import pool from '../config/database';

export interface SafeSyncResult {
  users: {
    total: number;
    new_users: number;
    updated_users: number;
    deleted_users: number;
    protected_fields: number;
  };
  errors: string[];
}

/**
 * 安全同步服务 - 只同步LDAP权威字段，保护本地业务数据
 */
export class SafeSyncService {
  
  /**
   * LDAP权威字段 - 这些字段应该与LDAP保持同步
   */
  private static readonly LDAP_AUTHORITATIVE_FIELDS = [
    'ldap_dn',
    'uid_number', 
    'gid_number',
    'home_directory',
    'login_shell'
  ];

  /**
   * 受保护的本地字段 - 这些字段不应该被LDAP同步覆盖
   */
  private static readonly PROTECTED_LOCAL_FIELDS = [
    'full_name',
    'email', 
    'phone',
    'user_type'  // 用户角色由系统管理，不由LDAP决定
  ];

  /**
   * 执行安全的LDAP用户同步
   * @param useMockData 是否使用模拟数据（用于测试）
   */
  static async performSafeSync(useMockData: boolean = false): Promise<SafeSyncResult> {
    const result: SafeSyncResult = {
      users: {
        total: 0,
        new_users: 0, 
        updated_users: 0,
        deleted_users: 0,
        protected_fields: 0
      },
      errors: []
    };

    try {
      console.log('🔄 开始安全LDAP同步...');

      // 1. 从LDAP获取所有用户
      let ldapUsers;
      if (useMockData) {
        console.log('🧪 使用模拟数据进行安全测试...');
        ldapUsers = await ldapService.getAllUsersWithPosix();
      } else {
        console.log('🔗 连接真实LDAP服务器...');
        try {
          ldapUsers = await ldapService.getAllUsersWithPosix();
        } catch (ldapError) {
          console.error('❌ LDAP连接失败，使用模拟模式:', ldapError.message);
          ldapUsers = await ldapService.getAllUsersWithPosix();
        }
      }
      result.users.total = ldapUsers.length;
      
      if (ldapUsers.length === 0) {
        console.log('⚠️ LDAP中没有找到用户');
        return result;
      }

      console.log(`📥 从LDAP获取到 ${ldapUsers.length} 个用户`);

      // 2. 获取数据库中现有用户
      const existingUsersQuery = 'SELECT id, username, ldap_dn FROM users';
      const existingUsersResult = await pool.query(existingUsersQuery);
      const existingUserMap = new Map<string, any>();
      existingUsersResult.rows.forEach(user => {
        existingUserMap.set(user.username, user);
      });

      // 3. 处理LDAP用户
      const processedUsernames = new Set<string>();
      
      for (const ldapUser of ldapUsers) {
        try {
          processedUsernames.add(ldapUser.uid);
          const existingUser = existingUserMap.get(ldapUser.uid);

          if (existingUser) {
            // 更新现有用户 - 只更新LDAP权威字段
            const updateCount = await this.safeUpdateUser(ldapUser, existingUser.id);
            if (updateCount > 0) {
              result.users.updated_users++;
            }
          } else {
            // 创建新用户
            await this.createNewUser(ldapUser);
            result.users.new_users++;
            console.log(`✅ 创建新用户: ${ldapUser.uid}`);
          }
        } catch (error) {
          console.error(`❌ 处理用户 ${ldapUser.uid} 失败:`, error);
          result.errors.push(`处理用户 ${ldapUser.uid} 失败: ${error.message}`);
        }
      }

      // 4. 处理不在LDAP中的用户（删除）
      const deletedCount = await this.deleteUsersNotInLDAP(processedUsernames);
      result.users.deleted_users = deletedCount;

      console.log(`✅ 安全同步完成: 总用户${result.users.total}个, 新增${result.users.new_users}个, 更新${result.users.updated_users}个, 删除${result.users.deleted_users}个`);
      
      // 5. 记录审计日志
      await this.logSyncAudit(result);
      
      return result;

    } catch (error) {
      console.error('❌ 安全同步失败:', error);
      result.errors.push(`同步失败: ${error.message}`);
      return result;
    }
  }

  /**
   * 安全更新用户 - 只更新LDAP权威字段
   */
  private static async safeUpdateUser(ldapUser: any, userId: number): Promise<number> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // 只更新LDAP权威字段
    const fieldsToCheck = {
      ldap_dn: ldapUser.dn,
      uid_number: ldapUser.uidNumber,
      gid_number: ldapUser.gidNumber,
      home_directory: ldapUser.homeDirectory,
      login_shell: ldapUser.loginShell || '/bin/bash'
    };

    for (const [field, value] of Object.entries(fieldsToCheck)) {
      if (value !== undefined) {
        updateFields.push(`${field} = $${updateValues.length + 2}`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) {
      return 0; // 没有需要更新的字段
    }

    // 执行更新
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}, 
          updated_at = CURRENT_TIMESTAMP,
          last_sync_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    const result = await pool.query(updateQuery, [userId, ...updateValues]);
    
    if (result.rowCount > 0) {
      console.log(`🔄 更新用户LDAP字段: ${ldapUser.uid} (${updateFields.length}个字段)`);
    }
    
    return result.rowCount;
  }

  /**
   * 创建新用户
   */
  private static async createNewUser(ldapUser: any): Promise<void> {
    const createQuery = `
      INSERT INTO users (
        ldap_dn, username, uid_number, gid_number, 
        home_directory, login_shell, user_type, 
        is_active, last_sync_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    `;

    const values = [
      ldapUser.dn,
      ldapUser.uid,
      ldapUser.uidNumber,
      ldapUser.gidNumber,
      ldapUser.homeDirectory,
      ldapUser.loginShell || '/bin/bash',
      'unassigned', // 新用户默认未分配角色
      true
    ];

    await pool.query(createQuery, values);
  }

  /**
   * 删除不在LDAP中的用户
   */
  private static async deleteUsersNotInLDAP(activeUsernames: Set<string>): Promise<number> {
    if (activeUsernames.size === 0) {
      return 0;
    }

    const placeholders = Array.from(activeUsernames).map((_, index) => `$${index + 1}`).join(', ');
    
    // 首先查找要删除的用户
    const findQuery = `
      SELECT id, username FROM users 
      WHERE username NOT IN (${placeholders}) 
        AND is_active = true
    `;
    const usersToDelete = await pool.query(findQuery, Array.from(activeUsernames));
    
    if (usersToDelete.rows.length === 0) {
      return 0;
    }

    let deletedCount = 0;
    
    // 逐个删除用户（包括级联删除相关数据）
    for (const user of usersToDelete.rows) {
      try {
        await pool.query('BEGIN');
        
        // 删除相关申请记录（如果存在）
        await pool.query('DELETE FROM requests WHERE student_user_id = $1', [user.id]);
        
        // 删除学生记录（如果存在）
        await pool.query('DELETE FROM students WHERE user_id = $1', [user.id]);
        
        // 删除PI记录（如果存在）
        await pool.query('DELETE FROM pis WHERE user_id = $1', [user.id]);
        
        // 删除用户记录
        const deleteResult = await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        
        await pool.query('COMMIT');
        
        if (deleteResult.rowCount > 0) {
          deletedCount++;
          console.log(`🗑️ 删除用户: ${user.username}`);
        }
        
      } catch (error) {
        await pool.query('ROLLBACK');
        console.error(`❌ 删除用户 ${user.username} 失败:`, error.message);
      }
    }
    
    if (deletedCount > 0) {
      console.log(`🗑️ 删除不在LDAP中的用户: ${deletedCount}个`);
    }
    
    return deletedCount;
  }

  /**
   * 检查用户的本地保护字段
   */
  static async checkProtectedFields(username: string): Promise<string[]> {
    const query = 'SELECT full_name, email, phone, user_type FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return [];
    }

    const user = result.rows[0];
    const protectedFields: string[] = [];

    // 检查哪些本地字段有数据（需要保护）
    if (user.full_name && user.full_name.trim() !== '') {
      protectedFields.push('full_name');
    }
    if (user.email && user.email.trim() !== '' && !user.email.includes('@ldap.')) {
      protectedFields.push('email');
    }
    if (user.phone && user.phone.trim() !== '') {
      protectedFields.push('phone');
    }
    if (user.user_type && user.user_type !== 'unassigned') {
      protectedFields.push('user_type');
    }

    return protectedFields;
  }

  /**
   * 记录同步审计日志
   */
  private static async logSyncAudit(result: SafeSyncResult): Promise<void> {
    try {
      await AuditService.logAction(
        'safe_ldap_sync',
        'system',
        0,
        {
          sync_result: result,
          sync_time: new Date().toISOString(),
          protection_note: '本次同步只更新LDAP权威字段，保护了本地业务数据'
        }
      );
    } catch (error) {
      console.error('记录同步审计日志失败:', error);
    }
  }

  /**
   * 获取同步状态报告
   */
  static async getSyncStatus(): Promise<any> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN user_type != 'unassigned' THEN 1 END) as assigned_users,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
          MAX(last_sync_at) as last_sync_time
        FROM users
      `;
      
      const result = await pool.query(statsQuery);
      return result.rows[0];
    } catch (error) {
      console.error('获取同步状态失败:', error);
      return null;
    }
  }
}

export const safeSyncService = new SafeSyncService();
export default safeSyncService;