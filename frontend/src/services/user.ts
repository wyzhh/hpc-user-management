import { apiCall } from './api';
import { ApiResponse, PaginatedResponse } from '../types';

export interface PIUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  department?: string;
  phone?: string;
  ldap_dn: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  student_count?: number;
}

export interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: 'admin' | 'super_admin';
  password_hash?: string;
  ldap_dn?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface StudentUser {
  id: number;
  username: string;
  chinese_name: string;
  email: string;
  phone?: string;
  pi_id: number;
  pi_name?: string;
  pi_username?: string;
  ldap_dn?: string;
  status: 'pending' | 'active' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface CreateAdminRequest {
  username: string;
  full_name: string;
  email: string;
  password?: string;
  role: 'admin' | 'super_admin';
  ldap_dn?: string;
}

export interface UpdateUserRequest {
  full_name?: string;
  email?: string;
  department?: string;
  phone?: string;
  is_active?: boolean;
}

class UserService {
  // 获取课题组长列表
  async getPIUsers(
    page = 1,
    limit = 10,
    active?: boolean,
    search?: string
  ): Promise<ApiResponse<PaginatedResponse<PIUser>>> {
    const params: any = { page, limit };
    if (active !== undefined) params.active = active;
    if (search) params.search = search;
    
    const response = await apiCall<{ pis: PIUser[]; total: number }>('GET', '/users/pis', undefined, params);
    
    if (response.success && response.data) {
      return {
        ...response,
        data: {
          items: response.data.pis,
          total: response.data.total,
          page,
          limit,
        },
      };
    }
    
    return {
      ...response,
      data: undefined
    } as ApiResponse<PaginatedResponse<PIUser>>;
  }

  // 获取管理员列表
  async getAdminUsers(
    page = 1,
    limit = 10,
    active?: boolean,
    search?: string
  ): Promise<ApiResponse<PaginatedResponse<AdminUser>>> {
    const params: any = { page, limit };
    if (active !== undefined) params.active = active;
    if (search) params.search = search;
    
    const response = await apiCall<{ admins: AdminUser[]; total: number }>('GET', '/users/admins', undefined, params);
    
    if (response.success && response.data) {
      return {
        ...response,
        data: {
          items: response.data.admins,
          total: response.data.total,
          page,
          limit,
        },
      };
    }
    
    return {
      ...response,
      data: undefined
    } as ApiResponse<PaginatedResponse<AdminUser>>;
  }

  // 获取学生列表
  async getStudentUsers(
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
    piId?: number
  ): Promise<ApiResponse<PaginatedResponse<StudentUser>>> {
    const params: any = { page, limit };
    if (status) params.status = status;
    if (search) params.search = search;
    if (piId) params.pi_id = piId;
    
    const response = await apiCall<{ students: StudentUser[]; total: number }>('GET', '/users/students', undefined, params);
    
    if (response.success && response.data) {
      return {
        ...response,
        data: {
          items: response.data.students,
          total: response.data.total,
          page,
          limit,
        },
      };
    }
    
    return {
      ...response,
      data: undefined
    } as ApiResponse<PaginatedResponse<StudentUser>>;
  }

  // 获取学生详情
  async getStudentUserById(id: number): Promise<ApiResponse<StudentUser>> {
    return await apiCall<StudentUser>('GET', `/users/students/${id}`);
  }

  // 更新学生状态
  async updateStudentStatus(id: number, status: 'pending' | 'active' | 'deleted'): Promise<ApiResponse<StudentUser>> {
    return await apiCall<StudentUser>('PUT', `/users/students/${id}/status`, { status });
  }

  // 删除学生账号
  async deleteStudentUser(id: number): Promise<ApiResponse<{ message: string }>> {
    return await apiCall('DELETE', `/users/students/${id}`);
  }

  // 重置学生密码（如果支持）
  async resetStudentPassword(id: number): Promise<ApiResponse<{ message: string; password: string }>> {
    return await apiCall('PUT', `/users/students/${id}/password`);
  }

  // 获取课题组长详情
  async getPIUserById(id: number): Promise<ApiResponse<PIUser>> {
    return await apiCall<PIUser>('GET', `/users/pis/${id}`);
  }

  // 获取管理员详情
  async getAdminUserById(id: number): Promise<ApiResponse<AdminUser>> {
    return await apiCall<AdminUser>('GET', `/users/admins/${id}`);
  }

  // 更新课题组长
  async updatePIUser(id: number, data: UpdateUserRequest): Promise<ApiResponse<PIUser>> {
    return await apiCall<PIUser>('PUT', `/users/pis/${id}`, data);
  }

  // 更新管理员
  async updateAdminUser(id: number, data: UpdateUserRequest): Promise<ApiResponse<AdminUser>> {
    return await apiCall<AdminUser>('PUT', `/users/admins/${id}`, data);
  }

  // 创建管理员
  async createAdminUser(data: CreateAdminRequest): Promise<ApiResponse<AdminUser>> {
    return await apiCall<AdminUser>('POST', '/users/admins', data);
  }

  // 激活/停用课题组长
  async togglePIUserStatus(id: number, active: boolean): Promise<ApiResponse<PIUser>> {
    return await apiCall<PIUser>('PUT', `/users/pis/${id}/status`, { is_active: active });
  }

  // 激活/停用管理员
  async toggleAdminUserStatus(id: number, active: boolean): Promise<ApiResponse<AdminUser>> {
    return await apiCall<AdminUser>('PUT', `/users/admins/${id}/status`, { is_active: active });
  }

  // 重置管理员密码
  async resetAdminPassword(id: number, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return await apiCall('PUT', `/users/admins/${id}/password`, { password: newPassword });
  }

  // 获取用户统计
  async getUserStats(): Promise<ApiResponse<{
    total_pis: number;
    active_pis: number;
    total_students: number;
    active_students: number;
    total_users: number;
    active_users: number;
    recent_pis: PIUser[];
  }>> {
    return await apiCall('GET', '/users/stats');
  }

  // 同步LDAP用户（完全同步）
  async syncLDAPUsers(): Promise<ApiResponse<{
    synced_pis: number;
    new_pis: number;
    updated_pis: number;
    sync_result?: {
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
    };
    message: string;
  }>> {
    return await apiCall('POST', '/users/sync-ldap');
  }

  // 增量同步LDAP用户
  async incrementalSyncLDAPUsers(lastSyncTime?: string): Promise<ApiResponse<{
    sync_result: {
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
    };
    message: string;
  }>> {
    const params = lastSyncTime ? { lastSyncTime } : undefined;
    return await apiCall('POST', '/users/sync-ldap-incremental', undefined, params);
  }

  // 获取所有用户（LDAP用户）
  async getAllUsers(
    page = 1,
    limit = 10,
    active?: boolean,
    search?: string
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const params: any = { page, limit };
    if (active !== undefined) params.active = active;
    if (search) params.search = search;
    
    const response = await apiCall<{ users: any[]; total: number }>('GET', '/users/all', undefined, params);
    
    if (response.success && response.data) {
      return {
        ...response,
        data: {
          items: response.data.users,
          total: response.data.total,
          page,
          limit
        }
      };
    }
    
    return response as any;
  }

  // 获取用户状态选项
  getStatusOptions() {
    return [
      { label: '活跃', value: true },
      { label: '已停用', value: false },
    ];
  }

  // 获取学生状态选项
  getStudentStatusOptions() {
    return [
      { label: '待审核', value: 'pending' },
      { label: '活跃', value: 'active' },
      { label: '已删除', value: 'deleted' },
    ];
  }

  // 获取管理员角色选项
  getAdminRoleOptions() {
    return [
      { label: '管理员', value: 'admin' },
      { label: '超级管理员', value: 'super_admin' },
    ];
  }

  // 获取用户状态显示文本
  getStatusText(isActive: boolean): string {
    return isActive ? '活跃' : '已停用';
  }

  // 获取用户状态颜色
  getStatusColor(isActive: boolean): string {
    return isActive ? 'green' : 'red';
  }

  // 获取学生状态显示文本
  getStudentStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: '待审核',
      active: '活跃',
      deleted: '已删除',
    };
    return statusMap[status] || status;
  }

  // 获取学生状态颜色
  getStudentStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      pending: 'orange',
      active: 'green',
      deleted: 'red',
    };
    return colorMap[status] || 'default';
  }

  // 获取管理员角色显示文本
  getRoleText(role: string): string {
    const roleMap: Record<string, string> = {
      admin: '管理员',
      super_admin: '超级管理员',
    };
    return roleMap[role] || role;
  }

  // 获取管理员角色颜色
  getRoleColor(role: string): string {
    const colorMap: Record<string, string> = {
      admin: 'blue',
      super_admin: 'purple',
    };
    return colorMap[role] || 'default';
  }

  // 格式化时间
  formatTime(timeStr: string): string {
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('zh-CN');
    } catch (error) {
      return timeStr;
    }
  }

  // 验证邮箱格式
  validateEmail(email: string): { valid: boolean; message?: string } {
    if (!email) {
      return { valid: false, message: '邮箱不能为空' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: '邮箱格式不正确' };
    }
    
    return { valid: true };
  }

  // 验证手机号格式
  validatePhone(phone?: string): { valid: boolean; message?: string } {
    if (!phone) {
      return { valid: true }; // 手机号是可选的
    }
    
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return { valid: false, message: '手机号格式不正确' };
    }
    
    return { valid: true };
  }

  // 验证密码强度
  validatePassword(password: string): { valid: boolean; message?: string } {
    if (!password) {
      return { valid: false, message: '密码不能为空' };
    }
    
    if (password.length < 8) {
      return { valid: false, message: '密码至少需要8个字符' };
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return { valid: false, message: '密码必须包含大小写字母和数字' };
    }
    
    return { valid: true };
  }
}

// 创建单例实例
export const userService = new UserService();
export default userService;