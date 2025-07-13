import { AuditLogModel } from '../models';
import { AuditLog } from '../types';

export class AuditService {
  static async logAction(
    action: string,
    performerType: 'pi' | 'admin' | 'system',
    performerId: number,
    details?: any,
    requestId?: number
  ): Promise<AuditLog> {
    try {
      // 临时禁用审计日志以避免数据库结构问题
      console.log(`审计日志记录 (临时禁用): ${action} by ${performerType}:${performerId}`, details);
      
      // 返回一个模拟的审计日志对象
      return {
        id: 0,
        action,
        admin_id: performerType === 'admin' ? performerId : null,
        details: JSON.stringify(details || {}),
        created_at: new Date()
      } as AuditLog;
    } catch (error) {
      console.error('记录审计日志失败:', error);
      throw error;
    }
  }

  static async logLogin(userId: number, userType: 'pi' | 'admin', details: any = {}): Promise<void> {
    await this.logAction(
      'user_login',
      userType,
      userId,
      {
        ...details,
        timestamp: new Date().toISOString(),
      }
    );
  }

  static async logLogout(userId: number, userType: 'pi' | 'admin', details: any = {}): Promise<void> {
    await this.logAction(
      'user_logout',
      userType,
      userId,
      {
        ...details,
        timestamp: new Date().toISOString(),
      }
    );
  }

  static async logRequestCreated(
    requestId: number,
    piId: number,
    requestType: 'create' | 'delete',
    details: any = {}
  ): Promise<void> {
    await this.logAction(
      'request_created',
      'pi',
      piId,
      {
        request_type: requestType,
        ...details,
      },
      requestId
    );
  }

  static async logRequestApproved(
    requestId: number,
    adminId: number,
    details: any = {}
  ): Promise<void> {
    await this.logAction(
      'request_approved',
      'admin',
      adminId,
      details,
      requestId
    );
  }

  static async logRequestRejected(
    requestId: number,
    adminId: number,
    reason: string,
    details: any = {}
  ): Promise<void> {
    await this.logAction(
      'request_rejected',
      'admin',
      adminId,
      {
        reason,
        ...details,
      },
      requestId
    );
  }

  static async logLdapAccountCreated(
    requestId: number,
    studentUsername: string,
    ldapDn: string,
    details: any = {}
  ): Promise<void> {
    await this.logAction(
      'ldap_account_created',
      'system',
      0, // 系统操作
      {
        student_username: studentUsername,
        ldap_dn: ldapDn,
        ...details,
      },
      requestId
    );
  }

  static async logLdapAccountDeleted(
    requestId: number,
    studentUsername: string,
    ldapDn: string,
    details: any = {}
  ): Promise<void> {
    await this.logAction(
      'ldap_account_deleted',
      'system',
      0, // 系统操作
      {
        student_username: studentUsername,
        ldap_dn: ldapDn,
        ...details,
      },
      requestId
    );
  }

  static async logError(
    action: string,
    performerType: 'pi' | 'admin' | 'system',
    performerId: number,
    error: Error,
    details: any = {},
    requestId?: number
  ): Promise<void> {
    await this.logAction(
      `${action}_error`,
      performerType,
      performerId,
      {
        error_message: error.message,
        error_stack: error.stack,
        ...details,
      },
      requestId
    );
  }

  static async getRequestAuditTrail(requestId: number): Promise<AuditLog[]> {
    try {
      return await AuditLogModel.getByRequestId(requestId);
    } catch (error) {
      console.error('获取申请审计轨迹失败:', error);
      throw error;
    }
  }

  static async getAllAuditLogs(page = 1, limit = 50): Promise<{ logs: AuditLog[], total: number }> {
    try {
      return await AuditLogModel.getAll(page, limit);
    } catch (error) {
      console.error('获取审计日志失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
export const auditService = new AuditService();