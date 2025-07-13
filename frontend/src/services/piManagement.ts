import api from './api';
import { ApiResponse, User, PIManagementStats } from '../types';

export interface PIManagementUsersResponse {
  users: User[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

class PIManagementService {
  // 获取可分配为PI的用户列表
  async getUsersForPIAssignment(
    page = 1, 
    limit = 20, 
    search = ''
  ): Promise<ApiResponse<PIManagementUsersResponse>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) {
      params.append('search', search);
    }

    const response = await api.get(`/users/pi-management/users?${params.toString()}`);
    return response.data;
  }

  // 设置用户为PI
  async assignUserAsPI(userId: number): Promise<ApiResponse<any>> {
    const response = await api.post('/users/pi-management/assign', {
      user_id: userId
    });
    return response.data;
  }

  // 移除用户的PI角色
  async removeUserFromPI(userId: number): Promise<ApiResponse<any>> {
    const response = await api.post('/users/pi-management/remove', {
      user_id: userId
    });
    return response.data;
  }

  // 获取PI管理统计信息
  async getStats(): Promise<ApiResponse<PIManagementStats>> {
    const response = await api.get('/users/pi-management/stats');
    return response.data;
  }
}

export const piManagementService = new PIManagementService();