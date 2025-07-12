export interface PIInfo {
  id: number;
  ldap_dn: string;
  username: string;
  full_name: string;
  email: string;
  department?: string;
  phone?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
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
  created_at: Date;
  updated_at: Date;
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
  requested_at: Date;
  reviewed_at?: Date;
}

export interface Admin {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: 'admin' | 'super_admin';
  password_hash?: string;
  ldap_dn?: string;
  is_active: boolean;
  created_at: Date;
}

export interface AuditLog {
  id: number;
  request_id?: number;
  action: string;
  performer_type: 'pi' | 'admin' | 'system';
  performer_id: number;
  details?: any;
  created_at: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  code: number;
}

export interface JWTPayload {
  id: number;
  username: string;
  role: 'pi' | 'admin';
  iat?: number;
  exp?: number;
}

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

export interface DatabaseConfig {
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}