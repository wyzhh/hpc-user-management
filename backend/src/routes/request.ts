import { Router } from 'express';
import { RequestController } from '../controllers/request';
import { authenticateToken, requirePI, requireAdmin, requireAnyRole } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validation';
import {
  paginationSchema,
  idParamSchema,
  approveRequestSchema,
  rejectRequestSchema,
} from '../middleware/validation';

const router = Router();

// 所有路由都需要认证
router.use(authenticateToken);

// PI和管理员都可以查看申请统计
router.get('/stats', requireAnyRole, RequestController.getRequestStats);

// PI相关路由
router.get('/my', requirePI, validateQuery(paginationSchema), RequestController.getMyRequests);

// 管理员相关路由
router.get('/all', requireAdmin, validateQuery(paginationSchema), RequestController.getAllRequests);
router.post('/:id/approve', requireAdmin, validateParams(idParamSchema), validate(approveRequestSchema), RequestController.approveRequest);
router.post('/:id/reject', requireAdmin, validateParams(idParamSchema), validate(rejectRequestSchema), RequestController.rejectRequest);

// 通用路由（PI和管理员都可以访问，但有权限控制）
router.get('/:id', requireAnyRole, validateParams(idParamSchema), RequestController.getRequestById);

export default router;