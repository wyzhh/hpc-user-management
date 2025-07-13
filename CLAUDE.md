# HPC用户管理系统 - Claude Code 快速上手文档

## 项目概述
这是一个HPC（高性能计算）用户管理系统，支持从LDAP导入用户，并提供基于角色的管理功能。

### 技术栈
- **后端**: Node.js + TypeScript + Express + PostgreSQL
- **前端**: React + TypeScript + Antd
- **认证**: JWT + LDAP集成
- **数据库**: PostgreSQL with Docker

## 当前系统架构

### 用户角色体系
1. **管理员 (Admin)**: 系统管理员，拥有所有权限
2. **PI (Principal Investigator)**: 课题负责人，可以管理自己的学生
3. **普通用户 (User)**: 从LDAP导入的基础用户，可被分配为PI或学生

### 核心功能模块

#### 1. 用户管理
- **LDAP集成**: 自动从LDAP导入用户 (`ou=users`)
- **定时同步**: 完全同步(每天2点) + 增量同步(每10分钟)
- **用户状态**: active/inactive，支持软删除

#### 2. PI管理 (已完成)
- **手动角色分配**: 管理员可将普通用户设置为PI
- **PI登录**: PI用户可以登录系统管理自己的学生
- **权限控制**: 基于JWT的角色验证

#### 3. 学生管理 (当前重点)

##### 3.1 PI学生管理 (已完成)
- **路径**: `/students` (PI用户访问)
- **功能**: PI创建新学生申请、查看学生列表、删除学生申请
- **统计显示**: 总学生数、活跃学生、待审核、已删除 (刚修复)

##### 3.2 管理员学生管理 (当前问题区域)
- **路径**: `/admin/student-management` 
- **功能**: 管理员分配现有LDAP用户作为学生给PI
- **当前问题**: 点击test123用户前的+号时有问题

## 最近完成的修复

### 1. PI登录问题 (已解决)
- **问题**: PI用户登录失败，数据库schema不匹配
- **解决**: 修复PIModel查询，使用JOIN连接users表

### 2. PI学生统计显示 (刚修复)
- **问题**: PI页面统计卡片显示0，学生列表无信息
- **解决**: 
  - 添加`StudentModel.getStatsByPiId()`方法
  - 添加`/students/stats` API接口
  - 修复`StudentModel.findByPiId()`的JOIN查询
  - 更新前端StudentManagement页面实时获取统计数据

## 当前问题

### 管理员学生管理页面问题
- **位置**: `/admin/student-management`
- **症状**: 点击test123用户前的+号时出现问题
- **影响**: 无法查看PI的学生列表

## 数据库结构

### 核心表
```sql
users - 用户基础信息 (从LDAP同步)
├── id, username, full_name, email, phone, ldap_dn, user_type
├── created_at, updated_at

pis - PI角色表
├── id, user_id (FK->users.id), is_active
├── created_at, updated_at

students - 学生表
├── id, user_id (FK->users.id), pi_id (FK->pis.id)
├── student_id, major, degree_level, status
├── join_date, created_at, updated_at
```

### 重要关系
- **PI**: users.id ← pis.user_id
- **学生**: users.id ← students.user_id
- **PI-学生**: pis.id ← students.pi_id

## API路径结构

### 用户相关
- `/users/pi-management/*` - PI角色管理
- `/users/student-management/*` - 管理员学生分配管理

### PI功能
- `/students/*` - PI自己的学生管理
- `/students/stats` - PI学生统计 (新增)

### 管理员功能
- `/admin/*` - 管理员专用接口

## 文件结构重点

### 后端关键文件
```
backend/src/
├── controllers/
│   ├── user.ts - 用户、PI、学生分配管理
│   └── student.ts - PI学生管理
├── models/index.ts - 数据库模型
├── routes/
│   ├── index.ts - 路由配置
│   ├── user.ts - 用户管理路由
│   └── student.ts - PI学生路由
└── services/ldap.ts - LDAP集成
```

### 前端关键文件
```
frontend/src/
├── pages/
│   ├── StudentManagement.tsx - PI学生管理页面
│   ├── AdminStudentManagement.tsx - 管理员学生分配页面
│   └── PIManagement.tsx - PI角色管理页面
├── services/
│   ├── student.ts - PI学生服务
│   ├── studentManagement.ts - 管理员学生服务
│   └── piManagement.ts - PI管理服务
└── components/student/ - 学生相关组件
```

## 测试数据

### 测试账号
- **管理员**: admin/admin123
- **PI用户**: test123 (已设置为PI，有1个学生)
- **学生**: wu_yan (已分配给test123)

### 验证命令
```bash
# 检查学生数据
node -e "
const pool = require('./dist/config/database.js').default;
pool.query('SELECT s.*, u.username FROM students s JOIN users u ON s.user_id = u.id').then(result => {
  console.log('学生列表:', result.rows);
  pool.end();
});"

# 检查PI统计
node -e "
const pool = require('./dist/config/database.js').default;
pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = \"active\" THEN 1 END) as active FROM students WHERE pi_id = 2').then(result => {
  console.log('PI统计:', result.rows[0]);
  pool.end();
});"
```

## 下一步开发建议

### 立即需要解决
1. **管理员学生管理页面**: 修复点击+号展开PI学生列表的问题
2. **UI优化**: 确保数据显示格式一致

### 中期目标
1. **申请审核流程**: 实现PI学生创建申请的管理员审核
2. **权限细化**: 更精细的权限控制
3. **审计日志**: 完善操作记录

## 常用调试命令

```bash
# 启动开发环境
cd /root/hpc-user-management/backend && npm run dev

# 检查数据库连接
node -e "const pool = require('./dist/config/database.js').default; pool.query('SELECT NOW()').then(r => console.log(r.rows[0]))"

# 重置用户类型
node -e "const pool = require('./dist/config/database.js').default; pool.query('UPDATE users SET user_type = \"user\" WHERE username != \"admin\"')"

# 查看PI列表
node -e "const pool = require('./dist/config/database.js').default; pool.query('SELECT p.id, u.username FROM pis p JOIN users u ON p.user_id = u.id WHERE p.is_active = true').then(r => console.log(r.rows))"
```

## 重要提醒

1. **路由变更**: 最近将`/admin/users`改为`/users`，所有相关API路径已更新
2. **数据库Schema**: pis表使用user_id外键，不直接存储username
3. **权限验证**: 所有PI功能需要PI角色验证，管理员功能需要admin角色
4. **LDAP同步**: 系统会自动同步LDAP用户，无需手动导入

---

**最后更新**: 2025-07-13
**当前状态**: PI学生统计已修复，管理员学生管理页面展开功能待修复