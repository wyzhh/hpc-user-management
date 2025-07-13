import { Request, Response } from 'express';
import { AuthService } from '../services/auth';
import { AuditService } from '../services/audit';

export class AuthController {
  static async loginPI(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      const result = await AuthService.authenticatePI(username, password);
      
      if (!result) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误',
          code: 401,
        });
      }

      const { pi, token } = result;

      // 记录登录日志
      await AuditService.logLogin(pi.id, 'pi', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // 计算token过期时间
      const expiresIn = 8 * 60 * 60 * 1000; // 8小时，单位毫秒
      const expires = Date.now() + expiresIn;

      res.json({
        success: true,
        message: '登录成功',
        code: 200,
        data: {
          token,
          expires,
          user: {
            id: pi.id,
            username: pi.username,
            full_name: pi.full_name,
            email: pi.email,
            department: pi.department,
            role: 'pi',
          },
        },
      });
    } catch (error) {
      console.error('PI登录错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  static async loginAdmin(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      const result = await AuthService.authenticateAdmin(username, password);
      
      if (!result) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误',
          code: 401,
        });
      }

      // 检查是否返回了错误
      if ('error' in result) {
        return res.status(result.code).json({
          success: false,
          message: result.error,
          code: result.code,
        });
      }

      const { admin, token } = result;

      // 记录登录日志
      await AuditService.logLogin(admin.id, 'admin', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // 计算token过期时间
      const expiresIn = 8 * 60 * 60 * 1000; // 8小时，单位毫秒
      const expires = Date.now() + expiresIn;

      res.json({
        success: true,
        message: '登录成功',
        code: 200,
        data: {
          token,
          expires,
          user: {
            id: admin.id,
            username: admin.username,
            full_name: admin.full_name,
            email: admin.email,
            role: 'admin',
          },
        },
      });
    } catch (error: any) {
      console.error('管理员登录错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  static async refreshToken(req: Request, res: Response) {
    try {
      const token = AuthService.extractTokenFromHeader(req.headers.authorization);
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: '缺少认证token',
          code: 401,
        });
      }

      const newToken = await AuthService.refreshToken(token);
      
      if (!newToken) {
        return res.status(401).json({
          success: false,
          message: '无法刷新token，请重新登录',
          code: 401,
        });
      }

      const expiresIn = 8 * 60 * 60 * 1000; // 8小时，单位毫秒
      const expires = Date.now() + expiresIn;

      res.json({
        success: true,
        message: 'Token刷新成功',
        code: 200,
        data: {
          token: newToken,
          expires,
        },
      });
    } catch (error) {
      console.error('Token刷新错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      // 记录登出日志
      if (req.userId && req.userRole) {
        await AuditService.logLogout(req.userId, req.userRole, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }

      res.json({
        success: true,
        message: '登出成功',
        code: 200,
      });
    } catch (error) {
      console.error('登出错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  static async getCurrentUser(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '未认证的用户',
          code: 401,
        });
      }

      res.json({
        success: true,
        message: '获取用户信息成功',
        code: 200,
        data: {
          id: req.user.id,
          username: req.user.username,
          full_name: req.user.full_name,
          email: req.user.email,
          role: req.userRole,
          // 根据角色返回不同的字段
          ...(req.userRole === 'pi' && {
            department: (req.user as any).department,
            phone: (req.user as any).phone,
          }),
        },
      });
    } catch (error) {
      console.error('获取当前用户信息错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }
}