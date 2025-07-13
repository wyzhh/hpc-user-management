import { apiCall } from './api';
import { Student, CreateStudentRequest, DeleteStudentRequest, ApiResponse, PaginatedResponse } from '../types';

class StudentService {
  // 获取我的学生列表
  async getMyStudents(
    page = 1,
    limit = 10,
    status?: string
  ): Promise<ApiResponse<PaginatedResponse<Student>>> {
    const params: any = { page, limit };
    if (status) {
      params.status = status;
    }
    
    const response = await apiCall<{ students: Student[]; total: number }>('GET', '/students', undefined, params);
    
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
    } as ApiResponse<PaginatedResponse<Student>>;
  }

  // 获取学生详情
  async getStudentById(id: number): Promise<ApiResponse<Student>> {
    return await apiCall<Student>('GET', `/students/${id}`);
  }

  // 创建学生申请
  async createStudentRequest(data: CreateStudentRequest): Promise<ApiResponse<{ request_id: number; status: string }>> {
    return await apiCall('POST', '/students/create-request', data);
  }

  // 删除学生申请
  async deleteStudentRequest(data: DeleteStudentRequest): Promise<ApiResponse<{ request_id: number; status: string }>> {
    return await apiCall('POST', '/students/delete-request', data);
  }

  // 检查用户名可用性
  async checkUsernameAvailability(username: string): Promise<ApiResponse<{ 
    username: string; 
    available: boolean; 
    reason: string; 
  }>> {
    return await apiCall('GET', `/students/check-username/${username}`);
  }

  // 获取学生统计信息
  async getMyStudentStats(): Promise<ApiResponse<{
    total: number;
    active: number;
    pending: number;
    deleted: number;
  }>> {
    return await apiCall('GET', '/students/stats');
  }

  // 获取学生状态选项
  getStatusOptions() {
    return [
      { label: '待审核', value: 'pending' },
      { label: '活跃', value: 'active' },
      { label: '已删除', value: 'deleted' },
    ];
  }

  // 获取学生状态显示文本
  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: '待审核',
      active: '活跃',
      deleted: '已删除',
    };
    return statusMap[status] || status;
  }

  // 获取学生状态颜色
  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      pending: 'orange',
      active: 'green',
      deleted: 'red',
    };
    return colorMap[status] || 'default';
  }

  // 验证用户名格式
  validateUsername(username: string): { valid: boolean; message?: string } {
    if (!username) {
      return { valid: false, message: '用户名不能为空' };
    }
    
    if (username.length < 3) {
      return { valid: false, message: '用户名至少需要3个字符' };
    }
    
    if (username.length > 50) {
      return { valid: false, message: '用户名不能超过50个字符' };
    }
    
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return { valid: false, message: '用户名只能包含字母和数字' };
    }
    
    return { valid: true };
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

  // 验证中文姓名格式
  validateChineseName(name: string): { valid: boolean; message?: string } {
    if (!name) {
      return { valid: false, message: '中文姓名不能为空' };
    }
    
    if (name.length < 2) {
      return { valid: false, message: '中文姓名至少需要2个字符' };
    }
    
    if (name.length > 50) {
      return { valid: false, message: '中文姓名不能超过50个字符' };
    }
    
    return { valid: true };
  }
}

// 创建单例实例
export const studentService = new StudentService();
export default studentService;