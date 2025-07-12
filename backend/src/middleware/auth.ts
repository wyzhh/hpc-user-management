import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';
import { JWTPayload, PIInfo, Admin } from '../types';

// 扩展Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: PIInfo | Admin;
      userRole?: 'pi' | 'admin';
      userId?: number;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '缺少认证token',
        code: 401,
      });
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: '无效的认证token',
        code: 401,
      });
    }

    // 验证用户是否仍然有效
    const user = await AuthService.validateUser(decoded.id, decoded.role);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用',
        code: 401,
      });
    }

    // 将用户信息添加到请求对象
    req.user = user;
    req.userRole = decoded.role;
    req.userId = decoded.id;

    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    return res.status(500).json({
      success: false,
      message: '认证过程发生错误',
      code: 500,
    });
  }
};

export const requireRole = (allowedRoles: ('pi' | 'admin')[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: '权限不足',
        code: 403,
      });
    }
    next();
  };
};

export const requirePI = requireRole(['pi']);
export const requireAdmin = requireRole(['admin']);
export const requireAnyRole = requireRole(['pi', 'admin']);

// 可选认证中间件（不强制要求token）
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      const decoded = AuthService.verifyToken(token);
      if (decoded) {
        const user = await AuthService.validateUser(decoded.id, decoded.role);
        if (user) {
          req.user = user;
          req.userRole = decoded.role;
          req.userId = decoded.id;
        }
      }
    }

    next();
  } catch (error) {
    console.error('可选认证中间件错误:', error);
    // 即使出错也继续执行，因为是可选认证
    next();
  }
};

// 检查PI是否有权限操作特定学生
export const checkStudentOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.userRole !== 'pi') {
      return res.status(403).json({
        success: false,
        message: '只有PI可以执行此操作',
        code: 403,
      });
    }

    const studentId = parseInt(req.params.studentId || req.body.student_id);
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: '缺少学生ID',
        code: 400,
      });
    }

    // 这里需要导入StudentModel来检查所有权
    const { StudentModel } = await import('../models');
    const hasOwnership = await StudentModel.checkOwnership(studentId, req.userId!);
    
    if (!hasOwnership) {
      return res.status(403).json({
        success: false,
        message: '您没有权限操作此学生账号',
        code: 403,
      });
    }

    next();
  } catch (error) {
    console.error('检查学生所有权错误:', error);
    return res.status(500).json({
      success: false,
      message: '权限检查过程发生错误',
      code: 500,
    });
  }
};

// 请求日志中间件
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      user: req.user ? `${req.userRole}:${req.user.username}` : 'anonymous',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };
    
    console.log('API请求:', JSON.stringify(logData));
  });

  next();
};