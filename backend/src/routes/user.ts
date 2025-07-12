import { Router } from 'express';
import { UserController } from '../controllers/user';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// 所有用户管理路由都需要管理员权限
router.use(requireAuth);
router.use(requireRole(['admin']));

// PI用户管理
router.get('/pis', UserController.getPIUsers);
router.get('/pis/:id', UserController.getPIUserById);
router.put('/pis/:id', UserController.updatePIUser);
router.put('/pis/:id/status', UserController.togglePIUserStatus);

// 管理员管理
router.get('/admins', UserController.getAdminUsers);
router.post('/admins', UserController.createAdminUser);
router.put('/admins/:id/password', UserController.resetAdminPassword);

// 学生管理
router.get('/students', UserController.getStudentUsers);
router.get('/students/:id', UserController.getStudentUserById);
router.put('/students/:id/status', UserController.updateStudentStatus);
router.delete('/students/:id', UserController.deleteStudentUser);

// 用户统计
router.get('/stats', UserController.getUserStats);

// LDAP同步
router.post('/sync-ldap', UserController.syncLDAPUsers);
router.post('/sync-ldap-incremental', UserController.incrementalSyncLDAPUsers);

export default router;