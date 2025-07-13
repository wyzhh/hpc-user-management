import api from './api';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
}

export interface Student {
  id: number;
  user_id: number;
  pi_id: number;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  created_at: string;
  pi_username: string;
  pi_full_name: string;
}

export interface PI {
  id: number;
  username: string;
  full_name: string;
  email: string;
  department?: string;
  students: Student[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message: string;
}

export const studentManagementService = {
  // 获取可分配为学生的用户列表
  async getUsersForStudentAssignment(): Promise<ApiResponse<{ users: User[] }>> {
    const response = await api.get('/users/student-management/users');
    return response.data;
  },

  // 分配学生给PI
  async assignStudentToPI(userId: number, piId: number): Promise<ApiResponse> {
    const response = await api.post('/users/student-management/assign', {
      user_id: userId,
      pi_id: piId,
    });
    return response.data;
  },

  // 移除PI的学生
  async removeStudentFromPI(userId: number): Promise<ApiResponse> {
    const response = await api.post('/users/student-management/remove', {
      user_id: userId,
    });
    return response.data;
  },

  // 获取PI及其学生列表
  async getPIsWithStudents(): Promise<ApiResponse<{ pis: PI[]; total_unassigned?: number }>> {
    const response = await api.get('/users/student-management/pis-with-students');
    return response.data;
  },
};