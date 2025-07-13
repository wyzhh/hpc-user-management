import { Router } from 'express';
import { StudentController } from '../controllers/student';
import { authenticateToken, requirePI } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validation';
import {
  createStudentSchema,
  deleteStudentSchema,
  paginationSchema,
  idParamSchema,
  usernameParamSchema,
} from '../middleware/validation';

const router = Router();

// 所有路由都需要PI认证
router.use(authenticateToken, requirePI);

// 获取我的学生列表
router.get('/', validateQuery(paginationSchema), StudentController.getMyStudents);

// 获取学生统计信息
router.get('/stats', StudentController.getMyStudentStats);

// 检查用户名可用性 - 必须在 /:id 之前定义
router.get('/check-username/:username', validateParams(usernameParamSchema), StudentController.checkUsernameAvailability);

// 创建学生申请
router.post('/create-request', validate(createStudentSchema), StudentController.createStudentRequest);

// 删除学生申请
router.post('/delete-request', validate(deleteStudentSchema), StudentController.deleteStudentRequest);

// 获取学生详情 - 放在最后避免路由冲突
router.get('/:id', validateParams(idParamSchema), StudentController.getStudentById);

export default router;