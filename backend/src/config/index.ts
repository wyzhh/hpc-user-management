import dotenv from 'dotenv';
import { LDAPConfig, DatabaseConfig } from '../types';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer: process.env.JWT_ISSUER || 'hpc-user-management',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/hpc_management',
  },

  ldap: {
    url: process.env.LDAP_URL || 'ldap://localhost:389',
    bindDN: process.env.LDAP_BIND_DN || 'cn=admin,dc=hpc,dc=university,dc=edu',
    bindCredentials: process.env.LDAP_BIND_PASSWORD || 'admin_password',
    baseDN: process.env.LDAP_BASE_DN || 'dc=hpc,dc=university,dc=edu',
    piOU: process.env.LDAP_PI_OU || 'ou=pis',
    studentOU: process.env.LDAP_STUDENT_OU || 'ou=students',
    groupsOU: process.env.LDAP_GROUPS_OU || 'ou=groups',
    
    // 连接配置
    connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || '30000', 10),
    timeout: parseInt(process.env.LDAP_TIMEOUT || '30000', 10),
    idleTimeout: parseInt(process.env.LDAP_IDLE_TIMEOUT || '60000', 10),
    
    // TLS配置
    tlsEnabled: process.env.LDAP_TLS_ENABLED === 'true',
    tlsRejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false',
    
    // 搜索配置
    searchScope: process.env.LDAP_SEARCH_SCOPE || 'sub',
    piSearchFilter: process.env.LDAP_PI_SEARCH_FILTER || '(uid={username})',
    studentSearchFilter: process.env.LDAP_STUDENT_SEARCH_FILTER || '(uid={username})',
    
    // 属性映射
    attributes: {
      pi: {
        username: process.env.LDAP_PI_USERNAME_ATTR || 'uid',
        name: process.env.LDAP_PI_NAME_ATTR || 'displayName',
        email: process.env.LDAP_PI_EMAIL_ATTR || 'mail',
        phone: process.env.LDAP_PI_PHONE_ATTR || 'telephoneNumber',
        department: process.env.LDAP_PI_DEPARTMENT_ATTR || 'ou',
        cn: process.env.LDAP_PI_CN_ATTR || 'cn',
      },
      student: {
        username: process.env.LDAP_STUDENT_USERNAME_ATTR || 'uid',
        name: process.env.LDAP_STUDENT_NAME_ATTR || 'displayName',
        email: process.env.LDAP_STUDENT_EMAIL_ATTR || 'mail',
        phone: process.env.LDAP_STUDENT_PHONE_ATTR || 'telephoneNumber',
      },
    },
  } as LDAPConfig,

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || 'HPC管理系统 <noreply@hpc.university.edu>',
  },
};

// 验证必要的环境变量
const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
  'LDAP_URL',
  'LDAP_BIND_DN',
  'LDAP_BIND_PASSWORD'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`缺少必要的环境变量: ${envVar}`);
    process.exit(1);
  }
}

export default config;