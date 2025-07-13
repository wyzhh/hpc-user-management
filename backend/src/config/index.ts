import dotenv from 'dotenv';

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

  // LDAP配置现在从 config/ldap.yaml 文件加载
  ldap: {
    configPath: process.env.LDAP_CONFIG_PATH || undefined, // 可选的自定义配置路径
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || 'HPC管理系统 <noreply@hpc.university.edu>',
  },

  debug: {
    mode: process.env.DEBUG_MODE === 'true',
    ldapDebug: process.env.LDAP_DEBUG === 'true',
  },
};

// 验证必要的环境变量（移除LDAP相关，因为现在使用配置文件）
const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`缺少必要的环境变量: ${envVar}`);
    process.exit(1);
  }
}

export default config;