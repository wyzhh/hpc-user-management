// 新的用户管理类型定义

// 基础用户信息 (所有从LDAP导入的用户)
export interface User {
  id: number;
  ldap_dn?: string;
  username: string;
  uid_number?: number;           // LDAP uid
  gid_number?: number;           // LDAP gid (课题组)
  full_name: string;
  email: string;
  phone?: string;
  home_directory?: string;       // LDAP homeDirectory
  login_shell?: string;          // LDAP loginShell
  user_type: 'pi' | 'student' | 'unassigned'; // 用户角色
  is_active: boolean;
  is_deleted_from_ldap: boolean; // 是否在LDAP中已删除
  created_at: Date;
  updated_at: Date;
  last_sync_at: Date;
}

// 课题组信息
export interface ResearchGroup {
  id: number;
  gid_number: number;           // 对应LDAP gid
  group_name: string;
  description?: string;
  pi_user_id?: number;          // 课题组PI的user_id
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// PI用户信息 (角色表)
export interface PIInfo {
  id: number;
  user_id: number;              // 关联users表
  department?: string;
  office_location?: string;
  research_area?: string;
  max_students: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  
  // 关联的用户基础信息
  user?: User;
  student_count?: number;
  
  // 兼容字段 (保持API兼容)
  ldap_dn?: string;
  username?: string;
  full_name?: string;
  email?: string;
  phone?: string;
}

// 学生用户信息 (角色表)
export interface Student {
  id: number;
  user_id?: number;             // 关联users表 (可选，用于新创建的学生)
  pi_id?: number;               // 所属PI
  student_id?: string;          // 学号
  major?: string;               // 专业
  enrollment_year?: number;     // 入学年份
  degree_level?: 'undergraduate' | 'master' | 'phd'; // 学位层次
  status: 'active' | 'graduated' | 'suspended' | 'deleted' | 'pending'; // 状态
  join_date?: Date;             // 加入课题组日期
  expected_graduation?: Date;   // 预期毕业时间
  created_at: Date;
  updated_at: Date;
  
  // 学生基础信息 (兼容老版本)
  username?: string;
  chinese_name?: string;
  email?: string;
  phone?: string;
  ldap_dn?: string;
  
  // 关联的用户基础信息
  user?: User;
  pi_name?: string;
  pi_username?: string;
}

// 申请信息
export interface Request {
  id: number;
  student_user_id?: number;     // 申请的学生用户ID (users表，创建申请时为null)
  pi_id: number;                // 目标PI (pis表)
  request_type: 'create' | 'delete' | 'join_group' | 'leave_group' | 'change_pi';
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewed_by?: number;         // 审核人PI ID
  reviewed_at?: Date | string;  // 可能是字符串格式
  review_comment?: string;
  requested_at: Date | string;  // 可能是字符串格式
  student_data?: string | object; // JSON数据，存储学生信息
  admin_id?: number;            // 审核管理员ID
  student_id?: number;          // 兼容字段，用于删除申请
  
  // 查询时附加的字段
  pi_username?: string;
  pi_name?: string;
}

// 管理员信息
export interface Admin {
  id: number;
  user_id?: number;             // 关联users表 (可选，LDAP管理员)
  username: string;
  full_name: string;
  email: string;
  password_hash?: string;       // 本地密码
  role: 'admin' | 'super_admin';
  auth_type: 'ldap' | 'local';  // 认证方式
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
  ldap_dn?: string;             // LDAP DN
}

// 同步日志
export interface SyncLog {
  id: number;
  sync_type: 'full' | 'incremental';
  total_users: number;
  new_users: number;
  updated_users: number;
  deleted_users: number;        // LDAP中删除的用户数
  errors?: string;              // 错误信息JSON
  performed_by?: number;        // 执行人ID
  started_at: Date;
  completed_at?: Date;
  duration_seconds?: number;
}

// 审计日志
export interface AuditLog {
  id: number;
  request_id?: number;          // 关联的申请ID
  action: string;               // 操作类型
  performer_type: 'admin' | 'pi' | 'system'; // 执行者类型
  performer_id: number;         // 执行者ID
  details: any;                 // 操作详情 (JSONB)
  table_name?: string;          // 操作的表名
  record_id?: number;           // 操作的记录ID
  old_values?: any;             // 操作前的值 (JSONB)
  new_values?: any;             // 操作后的值 (JSONB)
  performed_by?: number;        // 操作人ID
  ip_address?: string;          // 操作IP
  user_agent?: string;          // 用户代理
  created_at: Date;
}

// LDAP用户信息 (从LDAP查询返回)
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
  ou?: string;                  // 部门/组织单位
}

// 用户导入结果
export interface UserImportResult {
  total_found: number;          // LDAP中发现的用户总数
  new_imported: number;         // 新导入的用户数
  updated: number;              // 更新的用户数
  marked_deleted: number;       // 标记为删除的用户数
  errors: string[];             // 错误信息
  duration_ms: number;          // 导入耗时
}

// 角色分配请求
export interface RoleAssignmentRequest {
  user_id: number;
  role_type: 'pi' | 'student';
  role_data: any;               // 角色相关数据
}

// API响应
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  code: number;
}

// JWT载荷
export interface JWTPayload {
  id: number;
  username: string;
  role: 'pi' | 'admin';
  auth_type?: 'ldap' | 'local';
  iat?: number;
  exp?: number;
}

// 创建学生请求 (兼容)
export interface CreateStudentRequest {
  username: string;
  chinese_name: string;
  email: string;
  phone?: string;
  password: string;
}

// 删除学生请求 (兼容)
export interface DeleteStudentRequest {
  student_id: number;
}

// LDAP配置
export interface LDAPConfig {
  url: string;
  bindDN: string;
  bindCredentials: string;
  baseDN: string;
  piOU: string;
  studentOU: string;
  groupsOU: string;
  
  // 连接配置
  connectTimeout: number;
  timeout: number;
  idleTimeout: number;
  
  // TLS配置
  tlsEnabled: boolean;
  tlsRejectUnauthorized: boolean;
  
  // 搜索配置
  searchScope: string;
  piSearchFilter: string;
  studentSearchFilter: string;
  
  // 属性映射
  attributes: {
    pi: {
      username: string;
      name: string;
      email: string;
      phone: string;
      department: string;
      cn: string;
    };
    student: {
      username: string;
      name: string;
      email: string;
      phone: string;
    };
  };
}

// 数据库配置
export interface DatabaseConfig {
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

// 管理员配置 (从YAML文件加载)
export interface AdminConfig {
  username: string;
  full_name: string;
  email: string;
  auth_type: 'ldap' | 'local';
  role: 'admin' | 'super_admin';
  uid_number?: number;          // 如果是LDAP用户
  password?: string;            // 如果是本地用户
  permissions?: string[];       // 权限列表
}