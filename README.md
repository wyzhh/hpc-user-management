# HPC用户管理系统

基于LDAP的高性能计算中心用户管理系统，支持PI对学生账号的创建和删除管理。

## 功能特性

- PI通过LDAP认证登录
- 学生账号申请创建和删除
- 管理员审核流程
- 完整的权限控制和审计日志
- 现代化Web界面

## 技术栈

- **前端**: React + TypeScript + Ant Design
- **后端**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL
- **认证**: LDAP + JWT
- **容器化**: Docker + Docker Compose

## 项目结构

```
hpc-user-management/
├── backend/          # 后端API服务
├── frontend/         # 前端React应用
├── database/         # 数据库脚本和配置
├── docs/            # 项目文档
├── docker-compose.yml
└── README.md
```

## 快速开始

### 开发环境启动

1. 启动数据库和LDAP服务
```bash
docker-compose up -d db ldap
```

2. 启动后端服务
```bash
cd backend
npm install
npm run dev
```

3. 启动前端服务
```bash
cd frontend
npm install
npm start
```

### 生产环境部署

```bash
docker-compose up -d
```

## 环境变量配置

复制 `.env.example` 到 `.env` 并配置以下变量：

```env
# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/hpc_management

# LDAP配置
LDAP_URL=ldap://localhost:389
LDAP_BIND_DN=cn=admin,dc=hpc,dc=university,dc=edu
LDAP_BIND_PASSWORD=admin_password

# JWT配置
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=8h

# 应用配置
NODE_ENV=development
PORT=8000
```

## API文档

后端API接口文档请参考 [API Documentation](./docs/api.md)

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request# hpc-user-management
