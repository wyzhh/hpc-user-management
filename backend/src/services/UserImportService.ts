import { ldapService } from './ldap';
import { UserModel } from '../models/User';
import { LDAPUser, UserImportResult, SyncLog } from '../types';
import pool from '../config/database';

export class UserImportService {
  // 从LDAP导入所有用户
  async importAllUsersFromLDAP(): Promise<UserImportResult> {
    const startTime = Date.now();
    let newImported = 0;
    let updated = 0;
    let markedDeleted = 0;
    const errors: string[] = [];

    try {
      console.log('开始从LDAP导入用户...');
      
      // 获取LDAP中的所有用户
      const ldapUsers = await ldapService.getAllUsersWithPosix();
      console.log(`从LDAP获取到 ${ldapUsers.length} 个用户`);

      // 记录现有数据库中的用户名
      const existingUsersQuery = 'SELECT username FROM users WHERE is_deleted_from_ldap = false';
      const existingUsersResult = await pool.query(existingUsersQuery);
      const existingUsernames = new Set(existingUsersResult.rows.map(row => row.username));

      // 获取LDAP中的用户名集合
      const ldapUsernames = new Set(ldapUsers.map(user => user.uid));

      // 导入/更新用户
      for (const ldapUser of ldapUsers) {
        try {
          const existingUser = await UserModel.findByUsername(ldapUser.uid);
          
          if (existingUser) {
            // 用户已存在，更新信息
            const updatedUser = await UserModel.upsertFromLDAP(ldapUser);
            if (updatedUser) {
              updated++;
              console.log(`更新用户: ${ldapUser.uid}`);
            }
          } else {
            // 新用户，导入
            const newUser = await UserModel.upsertFromLDAP(ldapUser);
            if (newUser) {
              newImported++;
              console.log(`导入新用户: ${ldapUser.uid}`);
            }
          }
        } catch (error) {
          const errorMsg = `导入用户 ${ldapUser.uid} 失败: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // 标记在LDAP中已删除的用户
      const deletedUsernames = Array.from(existingUsernames).filter(
        username => !ldapUsernames.has(username)
      );
      
      if (deletedUsernames.length > 0) {
        markedDeleted = await UserModel.markAsDeletedFromLDAP(deletedUsernames);
        console.log(`标记 ${markedDeleted} 个用户为LDAP已删除`);
      }

      const duration = Date.now() - startTime;
      
      // 记录同步日志
      await this.logSyncResult({
        sync_type: 'full',
        total_users: ldapUsers.length,
        new_users: newImported,
        updated_users: updated,
        deleted_users: markedDeleted,
        errors: errors.length > 0 ? JSON.stringify(errors) : undefined,
        duration_seconds: Math.round(duration / 1000)
      });

      const result: UserImportResult = {
        total_found: ldapUsers.length,
        new_imported: newImported,
        updated: updated,
        marked_deleted: markedDeleted,
        errors: errors,
        duration_ms: duration
      };

      console.log('用户导入完成:', result);
      return result;

    } catch (error) {
      const errorMsg = `用户导入失败: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      
      await this.logSyncResult({
        sync_type: 'full',
        total_users: 0,
        new_users: 0,
        updated_users: 0,
        deleted_users: 0,
        errors: JSON.stringify(errors),
        duration_seconds: Math.round((Date.now() - startTime) / 1000)
      });

      throw error;
    }
  }

  // 增量导入特定用户
  async importSpecificUsers(usernames: string[]): Promise<UserImportResult> {
    const startTime = Date.now();
    let newImported = 0;
    let updated = 0;
    const errors: string[] = [];

    try {
      console.log(`开始导入指定用户: ${usernames.join(', ')}`);

      for (const username of usernames) {
        try {
          // 从LDAP获取用户信息
          const ldapUser = await ldapService.getUserByUsername(username);
          
          if (!ldapUser) {
            errors.push(`LDAP中未找到用户: ${username}`);
            continue;
          }

          const existingUser = await UserModel.findByUsername(username);
          
          if (existingUser) {
            await UserModel.upsertFromLDAP(ldapUser);
            updated++;
            console.log(`更新用户: ${username}`);
          } else {
            await UserModel.upsertFromLDAP(ldapUser);
            newImported++;
            console.log(`导入新用户: ${username}`);
          }
        } catch (error) {
          const errorMsg = `导入用户 ${username} 失败: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const duration = Date.now() - startTime;

      // 记录同步日志
      await this.logSyncResult({
        sync_type: 'incremental',
        total_users: usernames.length,
        new_users: newImported,
        updated_users: updated,
        deleted_users: 0,
        errors: errors.length > 0 ? JSON.stringify(errors) : undefined,
        duration_seconds: Math.round(duration / 1000)
      });

      const result: UserImportResult = {
        total_found: usernames.length,
        new_imported: newImported,
        updated: updated,
        marked_deleted: 0,
        errors: errors,
        duration_ms: duration
      };

      console.log('指定用户导入完成:', result);
      return result;

    } catch (error) {
      const errorMsg = `指定用户导入失败: ${error}`;
      console.error(errorMsg);
      throw error;
    }
  }

  // 根据课题组导入用户
  async importUsersByResearchGroup(gidNumber: number): Promise<UserImportResult> {
    const startTime = Date.now();
    let newImported = 0;
    let updated = 0;
    const errors: string[] = [];

    try {
      console.log(`开始导入课题组 ${gidNumber} 的用户...`);

      // 从LDAP获取指定gid的用户
      const ldapUsers = await ldapService.getUsersByGid(gidNumber);
      console.log(`课题组 ${gidNumber} 有 ${ldapUsers.length} 个用户`);

      for (const ldapUser of ldapUsers) {
        try {
          const existingUser = await UserModel.findByUsername(ldapUser.uid);
          
          if (existingUser) {
            await UserModel.upsertFromLDAP(ldapUser);
            updated++;
            console.log(`更新用户: ${ldapUser.uid}`);
          } else {
            await UserModel.upsertFromLDAP(ldapUser);
            newImported++;
            console.log(`导入新用户: ${ldapUser.uid}`);
          }
        } catch (error) {
          const errorMsg = `导入用户 ${ldapUser.uid} 失败: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const duration = Date.now() - startTime;

      const result: UserImportResult = {
        total_found: ldapUsers.length,
        new_imported: newImported,
        updated: updated,
        marked_deleted: 0,
        errors: errors,
        duration_ms: duration
      };

      console.log(`课题组 ${gidNumber} 用户导入完成:`, result);
      return result;

    } catch (error) {
      const errorMsg = `课题组用户导入失败: ${error}`;
      console.error(errorMsg);
      throw error;
    }
  }

  // 验证LDAP连接并获取用户数量
  async validateLDAPAndGetUserCount(): Promise<{ isConnected: boolean; userCount: number; error?: string }> {
    try {
      const isConnected = await ldapService.testConnection();
      
      if (!isConnected) {
        return { isConnected: false, userCount: 0, error: 'LDAP连接失败' };
      }

      const ldapUsers = await ldapService.getAllUsersWithPosix();
      return { isConnected: true, userCount: ldapUsers.length };

    } catch (error) {
      return { 
        isConnected: false, 
        userCount: 0, 
        error: `LDAP验证失败: ${error}` 
      };
    }
  }

  // 获取同步历史
  async getSyncHistory(limit = 50): Promise<SyncLog[]> {
    const query = `
      SELECT * FROM sync_logs 
      ORDER BY started_at DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  // 获取最近同步状态
  async getLastSyncStatus(): Promise<SyncLog | null> {
    const query = `
      SELECT * FROM sync_logs 
      ORDER BY started_at DESC 
      LIMIT 1
    `;
    
    const result = await pool.query(query);
    return result.rows[0] || null;
  }

  // 记录同步结果
  private async logSyncResult(syncData: Omit<SyncLog, 'id' | 'started_at' | 'completed_at' | 'performed_by'>): Promise<void> {
    const query = `
      INSERT INTO sync_logs (
        sync_type, total_users, new_users, updated_users, deleted_users, 
        errors, duration_seconds, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `;
    
    const values = [
      syncData.sync_type,
      syncData.total_users,
      syncData.new_users,
      syncData.updated_users,
      syncData.deleted_users,
      syncData.errors,
      syncData.duration_seconds
    ];

    await pool.query(query, values);
  }

  // 清理旧的同步日志
  async cleanupOldSyncLogs(daysToKeep = 30): Promise<number> {
    const query = `
      DELETE FROM sync_logs 
      WHERE started_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'
    `;
    
    const result = await pool.query(query);
    return result.rowCount || 0;
  }
}

export const userImportService = new UserImportService();