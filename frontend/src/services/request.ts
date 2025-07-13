import { apiCall } from './api';
import { Request, RequestStats, ApiResponse, PaginatedResponse } from '../types';

class RequestService {
  // PI获取自己的申请记录
  async getMyRequests(
    page = 1,
    limit = 10,
    status?: string,
    type?: string
  ): Promise<ApiResponse<PaginatedResponse<Request>>> {
    const params: any = { page, limit };
    if (status) params.status = status;
    if (type) params.type = type;
    
    const response = await apiCall<{ requests: Request[]; total: number }>('GET', '/requests/my', undefined, params);
    
    if (response.success && response.data) {
      return {
        ...response,
        data: {
          items: response.data.requests,
          total: response.data.total,
          page,
          limit,
        },
      };
    }
    
    return {
      ...response,
      data: undefined
    } as ApiResponse<PaginatedResponse<Request>>;
  }

  // 管理员获取所有申请记录
  async getAllRequests(
    page = 1,
    limit = 10,
    status?: string,
    pi_id?: number
  ): Promise<ApiResponse<PaginatedResponse<Request>>> {
    const params: any = { page, limit };
    if (status) params.status = status;
    if (pi_id) params.pi_id = pi_id;
    
    const response = await apiCall<{ requests: Request[]; total: number }>('GET', '/requests/all', undefined, params);
    
    if (response.success && response.data) {
      return {
        ...response,
        data: {
          items: response.data.requests,
          total: response.data.total,
          page,
          limit,
        },
      };
    }
    
    return {
      ...response,
      data: undefined
    } as ApiResponse<PaginatedResponse<Request>>;
  }

  // 获取申请详情
  async getRequestById(id: number): Promise<ApiResponse<{
    request: Request;
    audit_trail: any[];
  }>> {
    return await apiCall('GET', `/requests/${id}`);
  }

  // 管理员批准申请
  async approveRequest(id: number, reason?: string): Promise<ApiResponse<{
    request_id: number;
    status: string;
    student_id?: number;
  }>> {
    return await apiCall('POST', `/requests/${id}/approve`, { reason });
  }

  // 管理员拒绝申请
  async rejectRequest(id: number, reason: string): Promise<ApiResponse<{
    request_id: number;
    status: string;
    reason: string;
  }>> {
    return await apiCall('POST', `/requests/${id}/reject`, { reason });
  }

  // PI撤回申请
  async withdrawRequest(id: number): Promise<ApiResponse<{
    request_id: number;
    status: string;
  }>> {
    return await apiCall('POST', `/requests/${id}/withdraw`);
  }

  // 获取申请统计信息
  async getRequestStats(): Promise<ApiResponse<RequestStats>> {
    return await apiCall<RequestStats>('GET', '/requests/stats');
  }

  // 获取申请状态选项
  getStatusOptions() {
    return [
      { label: '待审核', value: 'pending' },
      { label: '已批准', value: 'approved' },
      { label: '已拒绝', value: 'rejected' },
      { label: '已撤回', value: 'withdrawn' },
    ];
  }

  // 获取申请类型选项
  getTypeOptions() {
    return [
      { label: '创建账号', value: 'create' },
      { label: '删除账号', value: 'delete' },
    ];
  }

  // 获取申请状态显示文本
  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: '待审核',
      approved: '已批准',
      rejected: '已拒绝',
      withdrawn: '已撤回',
    };
    return statusMap[status] || status;
  }

  // 获取申请类型显示文本
  getTypeText(type: string): string {
    const typeMap: Record<string, string> = {
      create: '创建账号',
      delete: '删除账号',
    };
    return typeMap[type] || type;
  }

  // 获取申请状态颜色
  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      pending: 'orange',
      approved: 'green',
      rejected: 'red',
      withdrawn: 'gray',
    };
    return colorMap[status] || 'default';
  }

  // 获取申请类型颜色
  getTypeColor(type: string): string {
    const colorMap: Record<string, string> = {
      create: 'blue',
      delete: 'volcano',
    };
    return colorMap[type] || 'default';
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
}

export const requestService = new RequestService();
export default requestService;