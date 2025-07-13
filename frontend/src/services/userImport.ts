import { apiCall } from './api';
import { ApiResponse } from '../types';
import { 
  UserImportResult, 
  SyncLog, 
  LDAPUser,
  User 
} from '../types';

class UserImportService {
  // 从LDAP导入所有用户
  async importAllUsersFromLDAP(): Promise<ApiResponse<{
    import_result: UserImportResult;
    message: string;
  }>> {
    return await apiCall('POST', '/admin/users/import-all-ldap');
  }

  // 导入指定用户
  async importSpecificUsers(usernames: string[]): Promise<ApiResponse<{
    import_result: UserImportResult;
    message: string;
  }>> {
    return await apiCall('POST', '/admin/users/import-specific', { usernames });
  }

  // 根据课题组导入用户
  async importUsersByResearchGroup(gidNumber: number): Promise<ApiResponse<{
    import_result: UserImportResult;
    message: string;
  }>> {
    return await apiCall('POST', `/admin/users/import-by-group/${gidNumber}`);
  }

  // 验证LDAP连接
  async validateLDAPConnection(): Promise<ApiResponse<{
    isConnected: boolean;
    userCount: number;
    error?: string;
  }>> {
    return await apiCall('GET', '/admin/users/validate-ldap');
  }

  // 获取同步历史
  async getSyncHistory(limit = 50): Promise<ApiResponse<{
    sync_logs: SyncLog[];
    total: number;
  }>> {
    return await apiCall('GET', '/admin/users/sync-history', undefined, { limit });
  }

  // 获取最近同步状态
  async getLastSyncStatus(): Promise<ApiResponse<SyncLog | null>> {
    return await apiCall('GET', '/admin/users/last-sync-status');
  }

  // 兼容：同步LDAP用户（重定向到导入）
  async syncLDAPUsers(): Promise<ApiResponse<{
    import_result: UserImportResult;
    message: string;
    // 兼容旧的前端接口
    synced_pis: number;
    new_pis: number;
    updated_pis: number;
  }>> {
    return await apiCall('POST', '/admin/users/sync-ldap');
  }

  // 兼容：增量同步
  async incrementalSyncLDAPUsers(lastSyncTime?: string): Promise<ApiResponse<{
    import_result: UserImportResult;
    message: string;
  }>> {
    const params = lastSyncTime ? { lastSyncTime } : undefined;
    return await apiCall('POST', '/admin/users/sync-ldap-incremental', undefined, params);
  }

  // 获取导入状态文本
  getImportStatusText(result: UserImportResult): string {
    const { total_found, new_imported, updated, marked_deleted, errors } = result;
    let text = `发现 ${total_found} 个用户，`;
    text += `新导入 ${new_imported} 个，`;
    text += `更新 ${updated} 个`;
    
    if (marked_deleted > 0) {
      text += `，标记删除 ${marked_deleted} 个`;
    }
    
    if (errors.length > 0) {
      text += `，${errors.length} 个错误`;
    }
    
    return text;
  }

  // 格式化导入时长
  formatDuration(durationMs: number): string {
    if (durationMs < 1000) {
      return `${durationMs}ms`;
    } else if (durationMs < 60000) {
      return `${Math.round(durationMs / 1000)}s`;
    } else {
      return `${Math.round(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`;
    }
  }

  // 格式化同步类型
  formatSyncType(syncType: string): string {
    const typeMap: Record<string, string> = {
      full: '完全同步',
      incremental: '增量同步'
    };
    return typeMap[syncType] || syncType;
  }

  // 获取同步状态颜色
  getSyncStatusColor(syncLog: SyncLog): string {
    if (syncLog.errors) {
      return 'red';
    }
    if (syncLog.new_users > 0 || syncLog.updated_users > 0) {
      return 'green';
    }
    return 'blue';
  }

  // 获取同步状态文本
  getSyncStatusText(syncLog: SyncLog): string {
    if (syncLog.errors) {
      return '同步失败';
    }
    if (syncLog.new_users > 0 || syncLog.updated_users > 0) {
      return '同步成功';
    }
    return '无变更';
  }
}

export const userImportService = new UserImportService();
export default userImportService;