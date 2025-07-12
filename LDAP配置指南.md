# LDAP配置指南

## 配置文件位置

LDAP配置通过环境变量进行，主要配置文件：
- `backend/.env` - 生产环境配置
- `backend/.env.ldap.example` - 完整配置模板

## 基本配置（必需）

```bash
# LDAP服务器地址
LDAP_URL=ldap://your-ldap-server.com:389

# 管理员绑定DN（用于管理操作）
LDAP_BIND_DN=cn=admin,dc=your-company,dc=com

# 管理员密码
LDAP_BIND_PASSWORD=your-admin-password

# 基础DN
LDAP_BASE_DN=dc=your-company,dc=com

# PI用户组织单位
LDAP_PI_OU=ou=pis

# 学生用户组织单位
LDAP_STUDENT_OU=ou=students
```

## 常见LDAP服务器配置

### 1. Active Directory
```bash
LDAP_URL=ldap://ad.company.com:389
LDAP_BIND_DN=CN=service-account,OU=Service Accounts,DC=company,DC=com
LDAP_BASE_DN=DC=company,DC=com
LDAP_PI_OU=OU=Faculty,OU=Users
LDAP_STUDENT_OU=OU=Students,OU=Users
```

### 2. OpenLDAP
```bash
LDAP_URL=ldap://openldap.company.com:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BASE_DN=dc=company,dc=com
LDAP_PI_OU=ou=faculty
LDAP_STUDENT_OU=ou=students
```

### 3. 使用LDAPS（安全连接）
```bash
LDAP_URL=ldaps://secure-ldap.company.com:636
LDAP_TLS_ENABLED=true
LDAP_TLS_REJECT_UNAUTHORIZED=true
```

## 高级配置（可选）

### 连接配置
```bash
LDAP_CONNECT_TIMEOUT=30000  # 连接超时（毫秒）
LDAP_TIMEOUT=30000          # 操作超时（毫秒）
LDAP_IDLE_TIMEOUT=60000     # 空闲超时（毫秒）
```

### 属性映射配置
```bash
# PI用户属性映射
LDAP_PI_USERNAME_ATTR=uid
LDAP_PI_NAME_ATTR=displayName
LDAP_PI_EMAIL_ATTR=mail
LDAP_PI_PHONE_ATTR=telephoneNumber
LDAP_PI_DEPARTMENT_ATTR=ou

# 学生用户属性映射
LDAP_STUDENT_USERNAME_ATTR=uid
LDAP_STUDENT_NAME_ATTR=displayName
LDAP_STUDENT_EMAIL_ATTR=mail
```

### 搜索配置
```bash
LDAP_SEARCH_SCOPE=sub                    # 搜索范围
LDAP_PI_SEARCH_FILTER=(uid={username})   # PI搜索过滤器
LDAP_STUDENT_SEARCH_FILTER=(uid={username})  # 学生搜索过滤器
```

## 配置验证

### 1. 使用配置检查工具
```bash
cd backend
node scripts/check-ldap-config.js
```

### 2. 测试LDAP连接
```bash
cd backend
npm run dev
# 查看启动日志中的LDAP连接测试结果
```

### 3. 手动测试
```bash
# 测试LDAP连接
ldapsearch -x -H ldap://your-server:389 -D "cn=admin,dc=company,dc=com" -w password -b "dc=company,dc=com" "(objectClass=*)"

# 测试PI用户认证
ldapwhoami -x -H ldap://your-server:389 -D "uid=pi001,ou=pis,dc=company,dc=com" -w pi-password
```

## 故障排除

### 常见问题

1. **连接超时**
   - 检查LDAP服务器地址和端口
   - 检查防火墙设置
   - 增加超时时间

2. **认证失败**
   - 验证绑定DN和密码
   - 检查用户DN格式
   - 确认用户存在于指定OU中

3. **搜索失败**
   - 检查基础DN设置
   - 验证OU配置
   - 确认搜索过滤器格式

4. **TLS/SSL问题**
   - 检查证书有效性
   - 设置`LDAP_TLS_REJECT_UNAUTHORIZED=false`用于测试

### 调试模式

在开发环境中，可以启用详细日志：
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

## 安全建议

1. **生产环境**：
   - 使用LDAPS而不是明文LDAP
   - 设置强密码
   - 限制绑定用户权限

2. **网络安全**：
   - 使用VPN或专用网络
   - 配置防火墙规则
   - 定期更新LDAP服务器

3. **访问控制**：
   - 创建专用服务账号
   - 最小权限原则
   - 定期审计访问日志