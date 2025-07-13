import { Router } from 'express';
import { InitializationController } from '../controllers/initialization';

const router = Router();

// 检查系统初始化状态
router.get('/status', InitializationController.getInitializationStatus);

// 创建数据库表
router.post('/create-tables', InitializationController.createTables);

// 获取所有LDAP用户
router.get('/ldap-users', InitializationController.getAllLDAPUsers);

// 搜索LDAP用户
router.get('/search-ldap-users', InitializationController.searchLDAPUsers);

// 设置管理员用户
router.post('/set-admin', InitializationController.setAdminUser);

// 获取当前管理员列表
router.get('/admin-users', InitializationController.getAdminUsers);

// 完成初始化
router.post('/complete', InitializationController.completeInitialization);

export default router;