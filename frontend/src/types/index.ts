// 用户相关类型
export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: 'pi' | 'admin';
  department?: string;
  phone?: string;
}

export interface Student {
  id: number;
  username: string;
  chinese_name: string;
  email: string;
  phone?: string;
  pi_id: number;
  ldap_dn?: string;
  status: 'pending' | 'active' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface Request {
  id: number;
  pi_id: number;
  request_type: 'create' | 'delete';
  student_id?: number;
  student_data?: any;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  admin_id?: number;
  requested_at: string;
  reviewed_at?: string;
  pi_username?: string;
  pi_name?: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  code: number;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// 分页响应类型
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// 认证相关类型
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expires: number;
  user: User;
}

// 学生管理相关类型
export interface CreateStudentRequest {
  username: string;
  chinese_name: string;
  email: string;
  phone?: string;
  reason: string;
}

export interface DeleteStudentRequest {
  student_id: number;
  reason: string;
}

// 申请统计类型
export interface RequestStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

// 表单字段类型
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required?: boolean;
  rules?: any[];
  options?: Array<{ label: string; value: string | number }>;
}

// 表格列类型
export interface TableColumn {
  title: string;
  dataIndex: string;
  key: string;
  width?: number;
  render?: (text: any, record: any, index: number) => React.ReactNode;
  sorter?: boolean;
  filters?: Array<{ text: string; value: string | number }>;
}

// 路由类型
export interface RouteConfig {
  path: string;
  element: React.ComponentType;
  protected?: boolean;
  roles?: ('pi' | 'admin')[];
}

// 菜单项类型
export interface MenuItem {
  key: string;
  icon?: React.ReactNode;
  label: string;
  path?: string;
  children?: MenuItem[];
  roles?: ('pi' | 'admin')[];
}