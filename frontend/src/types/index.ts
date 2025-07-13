// 基础用户类型（新架构）
export interface User {
  id: number;
  ldap_dn?: string;
  username: string;
  uid_number?: number;
  gid_number?: number;
  full_name: string;
  email: string;
  phone?: string;
  home_directory?: string;
  login_shell?: string;
  user_type?: 'pi' | 'student' | 'unassigned';
  is_active?: boolean;
  is_deleted_from_ldap?: boolean;
  created_at?: string;
  updated_at?: string;
  last_sync_at?: string;
  // Authentication-specific fields
  role?: 'pi' | 'admin';
}

// 课题组类型
export interface ResearchGroup {
  id: number;
  gid_number: number;
  group_name: string;
  description?: string;
  pi_user_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// PI用户类型（角色表）
export interface PIUser {
  id: number;
  user_id: number;
  department?: string;
  office_location?: string;
  research_area?: string;
  max_students: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // 关联的用户基础信息
  user?: User;
  student_count?: number;
  
  // 兼容字段（保持API兼容）
  ldap_dn?: string;
  username?: string;
  full_name?: string;
  email?: string;
  phone?: string;
}

// 管理员用户类型
export interface AdminUser {
  id: number;
  user_id?: number;
  username: string;
  full_name: string;
  email: string;
  password_hash?: string;
  role: 'admin' | 'super_admin';
  auth_type: 'ldap' | 'local';
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// 兼容的旧User类型
export interface LegacyUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: 'pi' | 'admin';
  department?: string;
  phone?: string;
}

// 学生用户类型（角色表）
export interface Student {
  id: number;
  user_id: number;
  pi_id?: number;
  student_id?: string;
  major?: string;
  enrollment_year?: number;
  degree_level?: 'undergraduate' | 'master' | 'phd';
  status: 'active' | 'graduated' | 'suspended';
  join_date?: string;
  expected_graduation?: string;
  created_at: string;
  updated_at: string;
  
  // 关联的用户基础信息
  user?: User;
  pi_name?: string;
  pi_username?: string;
  
  // 兼容字段（保持API兼容）
  username?: string;
  chinese_name?: string;
  email?: string;
  phone?: string;
  ldap_dn?: string;
}

// 学生用户类型（兼容旧版）
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
// 用户导入结果
export interface UserImportResult {
  total_found: number;
  new_imported: number;
  updated: number;
  marked_deleted: number;
  errors: string[];
  duration_ms: number;
}

// 角色分配请求
export interface RoleAssignmentRequest {
  user_id: number;
  role_type: 'pi' | 'student';
  role_data: any;
}

// 角色推荐结果
export interface RoleSuggestion {
  suggestedPI: User[];
  suggestedStudents: User[];
  reasoning: string;
}

// 角色分配验证结果
export interface RoleValidation {
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
}

// 用户统计信息
export interface UserStats {
  total: number;
  by_type: { [key: string]: number };
  active: number;
  deleted_from_ldap: number;
}

// 角色分配统计
export interface RoleAssignmentStats {
  total: number;
  by_role: { [key: string]: number };
  by_research_group: Array<{
    gid_number: number;
    user_count: number;
    pi_count: number;
    student_count: number;
  }>;
  unassigned_count: number;
}

// 同步日志
export interface SyncLog {
  id: number;
  sync_type: 'full' | 'incremental';
  total_users: number;
  new_users: number;
  updated_users: number;
  deleted_users: number;
  errors?: string;
  performed_by?: number;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
}

// 兼容的创建学生请求
export interface CreateStudentRequest {
  username: string;
  chinese_name: string;
  email: string;
  phone?: string;
  password: string;
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

// 管理员配置
export interface AdminConfig {
  username: string;
  full_name: string;
  email: string;
  auth_type: 'ldap' | 'local';
  role: 'admin' | 'super_admin';
  uid_number?: number;
  password?: string;
  permissions?: string[];
}

// LDAP用户信息
export interface LDAPUser {
  dn: string;
  uid: string;
  uidNumber: number;
  gidNumber: number;
  cn: string;
  displayName?: string;
  mail: string;
  telephoneNumber?: string;
  homeDirectory?: string;
  loginShell?: string;
  ou?: string;
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

// 用户过滤选项
export interface UserFilterOptions {
  user_type?: 'pi' | 'student' | 'unassigned';
  is_active?: boolean;
  is_deleted_from_ldap?: boolean;
  gid_number?: number;
  search?: string;
}

// 分页选项
export interface PaginationOptions {
  page: number;
  limit: number;
  totalPages: number;
}

// PI管理统计信息
export interface PIManagementStats {
  total_users: number;
  total_pis: number;
  total_students: number;
  unassigned_users: number;
  active_pis: number;
  inactive_pis: number;
}