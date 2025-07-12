import { ldapService } from './ldap';
import { PIModel, StudentModel } from '../models';
import { AuditService } from './audit';
import { PIInfo, Student } from '../types';
import pool from '../config/database';

export interface SyncResult {
  pis: {
    total: number;
    created: number;
    updated: number;
    deactivated: number;
  };
  students: {
    total: number;
    created: number;
    updated: number;
    deleted: number;
  };
  errors: string[];
}

export class SyncService {
  // 完全同步所有用户
  static async syncAllUsers(): Promise<SyncResult> {
    const result: SyncResult = {
      pis: { total: 0, created: 0, updated: 0, deactivated: 0 },
      students: { total: 0, created: 0, updated: 0, deleted: 0 },
      errors: []
    };

    try {
      console.log('开始完全同步LDAP用户...');

      // 同步PI用户
      const piResult = await this.syncPIUsers();
      result.pis = piResult;

      // 同步学生用户
      const studentResult = await this.syncStudentUsers();
      result.students = studentResult;

      console.log('LDAP用户完全同步完成:', result);
      return result;
    } catch (error) {
      console.error('完全同步用户失败:', error);
      result.errors.push(`完全同步失败: ${error.message}`);
      return result;
    }
  }

  // 同步PI用户
  static async syncPIUsers(): Promise<SyncResult['pis']> {
    const result = {
      total: 0,
      created: 0,
      updated: 0,
      deactivated: 0
    };

    try {
      console.log('开始同步PI用户...');

      // 1. 从LDAP获取所有PI用户
      const ldapPIs = await ldapService.getAllPIUsers();
      result.total = ldapPIs.length;

      if (ldapPIs.length === 0) {
        console.log('LDAP中没有找到PI用户');
        return result;
      }

      console.log(`从LDAP获取到 ${ldapPIs.length} 个PI用户`);

      // 2. 获取所有LDAP DN用于后续处理
      const ldapDns = ldapPIs.map(pi => pi.ldap_dn);

      // 3. 使用upsert批量同步PI用户
      for (const ldapPI of ldapPIs) {
        try {
          // 先检查用户是否存在（不考虑active状态）
          const checkQuery = 'SELECT id, is_active FROM pis WHERE username = $1';
          const checkResult = await pool.query(checkQuery, [ldapPI.username]);
          const existingPI = checkResult.rows[0];

          // 使用upsert同步用户
          await PIModel.upsert({
            ldap_dn: ldapPI.ldap_dn,
            username: ldapPI.username,
            full_name: ldapPI.full_name,
            email: ldapPI.email,
            department: ldapPI.department,
            phone: ldapPI.phone,
            is_active: true
          });

          if (existingPI) {
            result.updated++;
            console.log(`PI用户已更新: ${ldapPI.username}`);
          } else {
            result.created++;
            console.log(`PI用户已创建: ${ldapPI.username}`);
          }
        } catch (error) {
          console.error(`处理PI用户 ${ldapPI.username} 失败:`, error);
        }
      }

      // 4. 标记不在LDAP中的用户为不活跃
      const deactivatedCount = await PIModel.markInactiveByLdapDns(ldapDns);
      result.deactivated = deactivatedCount;

      console.log(`PI用户同步完成: 创建${result.created}个, 更新${result.updated}个, 停用${result.deactivated}个`);
      return result;
    } catch (error) {
      console.error('同步PI用户失败:', error);
      throw error;
    }
  }

  // 同步学生用户
  static async syncStudentUsers(): Promise<SyncResult['students']> {
    const result = {
      total: 0,
      created: 0,
      updated: 0,
      deleted: 0
    };

    try {
      console.log('开始同步学生用户...');

      // 1. 从LDAP获取所有学生用户
      const ldapStudents = await ldapService.getAllStudentUsers();
      result.total = ldapStudents.length;

      if (ldapStudents.length === 0) {
        console.log('LDAP中没有找到学生用户');
        return result;
      }

      console.log(`从LDAP获取到 ${ldapStudents.length} 个学生用户`);

      // 2. 获取所有PI用户用于匹配
      const allPIs = await PIModel.getAll(1, 10000, false);
      const piMap = new Map<string, number>();
      for (const pi of allPIs.pis) {
        piMap.set(pi.username, pi.id);
      }

      // 3. 获取所有LDAP DN用于后续处理
      const ldapDns = ldapStudents.map(student => student.ldap_dn!);

      // 4. 处理每个学生用户
      for (const ldapStudent of ldapStudents) {
        try {
          // 尝试匹配PI
          let piId = 0;
          
          // 方法1: 通过LDAP DN推断PI
          const piUsername = await ldapService.getStudentPIMapping(ldapStudent.ldap_dn!);
          if (piUsername && piMap.has(piUsername)) {
            piId = piMap.get(piUsername)!;
          }
          
          // 方法2: 如果推断失败，使用默认PI或跳过
          if (piId === 0) {
            // 可以设置一个默认PI，或者跳过这个学生
            console.warn(`无法为学生 ${ldapStudent.username} 找到对应的PI，跳过同步`);
            continue;
          }

          // 检查学生是否已存在
          const existingStudent = await StudentModel.findByUsername(ldapStudent.username);
          
          if (existingStudent) {
            // 更新现有学生
            await StudentModel.update(existingStudent.id, {
              chinese_name: ldapStudent.chinese_name,
              email: ldapStudent.email,
              phone: ldapStudent.phone,
              pi_id: piId,
              ldap_dn: ldapStudent.ldap_dn,
              status: 'active'
            });
            result.updated++;
            console.log(`学生用户已更新: ${ldapStudent.username}`);
          } else {
            // 创建新学生
            await StudentModel.create({
              username: ldapStudent.username,
              chinese_name: ldapStudent.chinese_name,
              email: ldapStudent.email,
              phone: ldapStudent.phone,
              pi_id: piId,
              ldap_dn: ldapStudent.ldap_dn,
              status: 'active'
            });
            result.created++;
            console.log(`学生用户已创建: ${ldapStudent.username}`);
          }
        } catch (error) {
          console.error(`处理学生用户 ${ldapStudent.username} 失败:`, error);
        }
      }

      // 5. 标记不在LDAP中的学生为已删除
      const deletedCount = await StudentModel.markDeletedByLdapDns(ldapDns);
      result.deleted = deletedCount;

      console.log(`学生用户同步完成: 创建${result.created}个, 更新${result.updated}个, 删除${result.deleted}个`);
      return result;
    } catch (error) {
      console.error('同步学生用户失败:', error);
      throw error;
    }
  }

  // 增量同步（基于时间戳）
  static async incrementalSync(lastSyncTime?: Date): Promise<SyncResult> {
    // 这里可以实现基于时间戳的增量同步
    // 目前LDAP不支持时间戳查询，所以暂时使用完全同步
    console.log('执行增量同步（当前实现为完全同步）');
    return await this.syncAllUsers();
  }

  // 记录同步审计日志
  static async logSyncAudit(result: SyncResult, performerId: number = 0): Promise<void> {
    try {
      await AuditService.logAction(
        'ldap_full_sync',
        'system',
        performerId,
        {
          sync_result: result,
          sync_time: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error('记录同步审计日志失败:', error);
    }
  }
}

// 创建单例实例
export const syncService = new SyncService();
export default syncService;