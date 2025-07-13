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

// LDAP用户导入（新架构）
router.post('/import-all-ldap', UserController.importAllUsersFromLDAP);
router.post('/import-specific', UserController.importSpecificUsers);

// 所有用户管理（新架构）
router.get('/all', UserController.getAllUsers);
router.get('/unassigned', UserController.getUnassignedUsers);
router.post('/assign-role', UserController.assignUserRole);
router.post('/batch-assign-roles', UserController.batchAssignRoles);
router.get('/suggest-roles/:gid_number', UserController.suggestRolesByGroup);

// PI管理功能
router.get('/pi-management/users', UserController.getUsersForPIAssignment);
router.post('/pi-management/assign', UserController.assignUserAsPI);
router.post('/pi-management/remove', UserController.removeUserFromPI);
router.get('/pi-management/stats', UserController.getPIManagementStats);

// 学生管理功能
router.get('/student-management/users', UserController.getUsersForStudentAssignment);
router.post('/student-management/assign', UserController.assignStudentToPI);
router.post('/student-management/remove', UserController.removeStudentFromPI);
router.get('/student-management/pis-with-students', UserController.getPIsWithStudents);

// 管理员配置和系统功能
router.post('/sync-admin-config', UserController.syncAdminConfig);
router.get('/validate-ldap', UserController.validateLDAPConnection);
router.get('/sync-history', UserController.getSyncHistory);

// LDAP同步（向后兼容）
router.post('/sync-ldap', UserController.syncLDAPUsers);
router.post('/sync-ldap-incremental', UserController.incrementalSyncLDAPUsers);

export default router;