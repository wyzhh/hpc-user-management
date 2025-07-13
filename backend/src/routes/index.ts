import { Router } from 'express';
import authRoutes from './auth';
import studentRoutes from './student';
import requestRoutes from './request';
import userRoutes from './user';
import initializationRoutes from './initialization';
import syncRoutes from './sync';
import { requestLogger } from '../middleware/auth';

const router = Router();

// 添加请求日志中间件
router.use(requestLogger);

// API路由
router.use('/initialization', initializationRoutes);
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/requests', requestRoutes);
router.use('/users', userRoutes);
router.use('/sync', syncRoutes);

// API文档路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'HPC用户管理系统API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login/pi': 'PI用户登录',
        'POST /api/auth/login/admin': '管理员登录',
        'POST /api/auth/refresh': '刷新token',
        'POST /api/auth/logout': '用户登出',
        'GET /api/auth/me': '获取当前用户信息',
      },
      students: {
        'GET /api/students': '获取我的学生列表',
        'GET /api/students/:id': '获取学生详情',
        'POST /api/students/create-request': '创建学生申请',
        'POST /api/students/delete-request': '删除学生申请',
        'GET /api/students/check-username/:username': '检查用户名可用性',
      },
      requests: {
        'GET /api/requests/stats': '获取申请统计',
        'GET /api/requests/my': 'PI获取自己的申请记录',
        'GET /api/requests/all': '管理员获取所有申请记录',
        'GET /api/requests/:id': '获取申请详情',
        'POST /api/requests/:id/approve': '管理员批准申请',
        'POST /api/requests/:id/reject': '管理员拒绝申请',
      },
      users: {
        'GET /api/admin/users/pis': '获取PI用户列表',
        'GET /api/admin/users/pis/:id': '获取PI用户详情',
        'PUT /api/admin/users/pis/:id': '更新PI用户',
        'PUT /api/admin/users/pis/:id/status': '切换PI用户状态',
        'GET /api/admin/users/admins': '获取管理员列表',
        'POST /api/admin/users/admins': '创建管理员',
        'PUT /api/admin/users/admins/:id/password': '重置管理员密码',
        'GET /api/admin/users/stats': '获取用户统计',
        'POST /api/admin/users/sync-ldap': '同步LDAP用户',
      },
    },
    docs: 'https://github.com/your-org/hpc-user-management/blob/main/docs/api.md',
  });
});

export default router;