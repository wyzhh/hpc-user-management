import { Router } from 'express';
import { AuthController } from '../controllers/auth';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { loginSchema } from '../middleware/validation';

const router = Router();

// PI登录
router.post('/login/pi', validate(loginSchema), AuthController.loginPI);

// 管理员登录
router.post('/login/admin', validate(loginSchema), AuthController.loginAdmin);

// 刷新token
router.post('/refresh', AuthController.refreshToken);

// 登出
router.post('/logout', authenticateToken, AuthController.logout);

// 获取当前用户信息
router.get('/me', authenticateToken, AuthController.getCurrentUser);

export default router;