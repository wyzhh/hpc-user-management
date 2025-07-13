import express from 'express';
import SyncController from '../controllers/sync';

const router = express.Router();

// 手动执行安全同步
router.post('/safe-sync', SyncController.performSafeSync);

// 获取同步状态
router.get('/status', SyncController.getSyncStatus);

// 检查用户字段保护状态
router.get('/protection/:username', SyncController.checkUserProtection);

export default router;