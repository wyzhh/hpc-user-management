import { apiCall } from './api';
import { ApiResponse, PaginatedResponse } from '../types';
import { 
  User, 
  PIUser, 
  Student, 
  RoleAssignmentRequest,
  RoleSuggestion,
  RoleValidation,
  RoleAssignmentStats,
  UserFilterOptions,
  PaginationOptions
} from '../types';

class RoleAssignmentService {
  // 获取所有用户列表
  async getAllUsers(
    page = 1,
    limit = 20,
    filters?: UserFilterOptions
  ): Promise<ApiResponse<{
    users: User[];
    total: number;
    pagination: PaginationOptions;
  }>> {
    const params: any = { page, limit };
    if (filters) {
      Object.assign(params, filters);
    }
    return await apiCall('GET', '/admin/users/all', undefined, params);
  }

  // 获取未分配角色的用户
  async getUnassignedUsers(
    page = 1,
    limit = 20,
    search?: string
  ): Promise<ApiResponse<{
    users: User[];
    total: number;
    pagination: PaginationOptions;
  }>> {
    const params: any = { page, limit };
    if (search) params.search = search;
    return await apiCall('GET', '/admin/users/unassigned', undefined, params);
  }

  // 分配用户角色
  async assignUserRole(
    userId: number,
    roleType: 'pi' | 'student',
    roleData: any = {}
  ): Promise<ApiResponse<{
    result: PIUser | Student;
    validation: RoleValidation;
  }>> {
    return await apiCall('POST', '/admin/users/assign-role', {
      user_id: userId,
      role_type: roleType,
      role_data: roleData
    });
  }

  // 批量分配角色
  async batchAssignRoles(
    assignments: RoleAssignmentRequest[]
  ): Promise<ApiResponse<{
    successful: number;
    failed: Array<{ userId: number; error: string }>;
  }>> {
    return await apiCall('POST', '/admin/users/batch-assign-roles', { assignments });
  }

  // 取消角色分配
  async unassignUserRole(userId: number): Promise<ApiResponse<boolean>> {
    return await apiCall('DELETE', `/admin/users/${userId}/role`);
  }

  // 更改用户角色
  async changeUserRole(
    userId: number,
    newRoleType: 'pi' | 'student',
    roleData: any
  ): Promise<ApiResponse<PIUser | Student>> {
    return await apiCall('PUT', `/admin/users/${userId}/role`, {
      role_type: newRoleType,
      role_data: roleData
    });
  }

  // 根据课题组推荐角色
  async suggestRolesByResearchGroup(gidNumber: number): Promise<ApiResponse<RoleSuggestion>> {
    return await apiCall('GET', `/admin/users/suggest-roles/${gidNumber}`);
  }

  // 验证角色分配
  async validateRoleAssignment(
    userId: number,
    roleType: 'pi' | 'student'
  ): Promise<ApiResponse<RoleValidation>> {
    return await apiCall('POST', '/admin/users/validate-role', {
      user_id: userId,
      role_type: roleType
    });
  }

  // 获取角色分配统计
  async getRoleAssignmentStats(): Promise<ApiResponse<RoleAssignmentStats>> {
    return await apiCall('GET', '/admin/users/role-stats');
  }

  // 获取用户详情
  async getUserById(userId: number): Promise<ApiResponse<User>> {
    return await apiCall('GET', `/admin/users/${userId}`);
  }

  // 更新用户基础信息
  async updateUser(userId: number, data: Partial<User>): Promise<ApiResponse<User>> {
    return await apiCall('PUT', `/users/${userId}`, data);
  }

  // 软删除用户
  async softDeleteUser(userId: number): Promise<ApiResponse<boolean>> {
    return await apiCall('PUT', `/admin/users/${userId}/soft-delete`);
  }

  // 恢复用户
  async restoreUser(userId: number): Promise<ApiResponse<boolean>> {
    return await apiCall('PUT', `/admin/users/${userId}/restore`);
  }

  // 获取用户类型选项
  getUserTypeOptions() {
    return [
      { label: '未分配', value: 'unassigned' },
      { label: 'PI用户', value: 'pi' },
      { label: '学生', value: 'student' }
    ];
  }

  // 获取学位层次选项
  getDegreeLevelOptions() {
    return [
      { label: '本科生', value: 'undergraduate' },
      { label: '硕士生', value: 'master' },
      { label: '博士生', value: 'phd' }
    ];
  }

  // 获取学生状态选项
  getStudentStatusOptions() {
    return [
      { label: '在读', value: 'active' },
      { label: '已毕业', value: 'graduated' },
      { label: '休学', value: 'suspended' }
    ];
  }

  // 获取用户类型显示文本
  getUserTypeText(userType?: string): string {
    if (!userType) return '未知';
    const typeMap: Record<string, string> = {
      unassigned: '未分配',
      pi: 'PI用户',
      student: '学生'
    };
    return typeMap[userType] || userType;
  }

  // 获取用户类型颜色
  getUserTypeColor(userType?: string): string {
    if (!userType) return 'default';
    const colorMap: Record<string, string> = {
      unassigned: 'orange',
      pi: 'blue',
      student: 'green'
    };
    return colorMap[userType] || 'default';
  }

  // 获取学位层次显示文本
  getDegreeLevelText(degreeLevel?: string): string {
    if (!degreeLevel) return '未设置';
    const levelMap: Record<string, string> = {
      undergraduate: '本科生',
      master: '硕士生',
      phd: '博士生'
    };
    return levelMap[degreeLevel] || degreeLevel;
  }

  // 获取学生状态显示文本
  getStudentStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      active: '在读',
      graduated: '已毕业',
      suspended: '休学'
    };
    return statusMap[status] || status;
  }

  // 获取学生状态颜色
  getStudentStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      active: 'green',
      graduated: 'blue',
      suspended: 'orange'
    };
    return colorMap[status] || 'default';
  }

  // 格式化课题组信息
  formatResearchGroup(user: User): string {
    if (!user.gid_number) return '未分配';
    return `课题组 ${user.gid_number}`;
  }

  // 验证角色数据
  validateRoleData(roleType: 'pi' | 'student', roleData: any): { valid: boolean; message?: string } {
    if (roleType === 'pi') {
      if (!roleData.department) {
        return { valid: false, message: '请填写部门信息' };
      }
    } else if (roleType === 'student') {
      if (roleData.pi_id && !Number.isInteger(roleData.pi_id)) {
        return { valid: false, message: '请选择有效的PI导师' };
      }
    }
    return { valid: true };
  }

  // 生成角色分配建议
  generateRoleAssignmentSuggestion(user: User): string {
    const suggestions = [];
    
    // 基于用户名的建议
    const username = user.username.toLowerCase();
    if (username.includes('prof') || username.includes('teacher')) {
      suggestions.push('用户名包含教师相关字样，建议分配为PI用户');
    } else if (/\d{6,}/.test(username)) {
      suggestions.push('用户名包含长数字序列，可能是学号，建议分配为学生');
    }
    
    // 基于邮箱的建议
    if (user.email.includes('faculty') || user.email.includes('prof')) {
      suggestions.push('邮箱包含教师相关字样，建议分配为PI用户');
    } else if (user.email.includes('student')) {
      suggestions.push('邮箱包含学生字样，建议分配为学生');
    }
    
    // 基于课题组的建议
    if (user.gid_number) {
      suggestions.push(`属于课题组 ${user.gid_number}，建议查看该课题组现有角色分配`);
    }
    
    return suggestions.length > 0 ? suggestions.join('；') : '无明显特征，请根据实际情况分配角色';
  }
}

export const roleAssignmentService = new RoleAssignmentService();
export default roleAssignmentService;