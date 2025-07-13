import { Request, Response } from 'express';
import { InitializationService } from '../services/InitializationService';

export class InitializationController {
  
  /**
   * 检查系统初始化状态
   */
  static async getInitializationStatus(req: Request, res: Response) {
    try {
      const status = await InitializationService.checkInitializationStatus();
      
      res.json({
        success: true,
        message: '初始化状态检查完成',
        code: 200,
        data: status
      });
    } catch (error) {
      console.error('检查初始化状态失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
        error: error
      });
    }
  }

  /**
   * 创建数据库表
   */
  static async createTables(req: Request, res: Response) {
    try {
      const result = await InitializationService.createTables();
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          code: 200
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message,
          code: 500
        });
      }
    } catch (error) {
      console.error('创建数据库表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
        error: error
      });
    }
  }

  /**
   * 获取所有LDAP用户
   */
  static async getAllLDAPUsers(req: Request, res: Response) {
    try {
      console.log('获取所有LDAP用户');
      const users = await InitializationService.getAllLDAPUsers();
      
      res.json({
        success: true,
        message: `获取到 ${users.length} 个LDAP用户`,
        code: 200,
        data: users
      });
    } catch (error: any) {
      console.error('获取LDAP用户失败:', error);
      res.status(500).json({
        success: false,
        message: `获取用户失败: ${error}`,
        code: 500
      });
    }
  }

  /**
   * 搜索LDAP用户
   */
  static async searchLDAPUsers(req: Request, res: Response) {
    try {
      const { searchTerm } = req.query;
      
      if (!searchTerm || typeof searchTerm !== 'string') {
        return res.status(400).json({
          success: false,
          message: '请提供搜索关键词',
          code: 400
        });
      }

      if (searchTerm.length < 2) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词至少需要2个字符',
          code: 400
        });
      }

      console.log(`搜索LDAP用户: ${searchTerm}`);
      const users = await InitializationService.searchLDAPUsers(searchTerm);
      
      res.json({
        success: true,
        message: `找到 ${users.length} 个匹配的用户`,
        code: 200,
        data: users
      });
    } catch (error) {
      console.error('搜索LDAP用户失败:', error);
      res.status(500).json({
        success: false,
        message: `搜索失败: ${error}`,
        code: 500
      });
    }
  }

  /**
   * 设置管理员用户
   */
  static async setAdminUser(req: Request, res: Response) {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          message: '请提供用户名',
          code: 400
        });
      }

      console.log(`设置管理员用户: ${username}`);
      const result = await InitializationService.setAdminUser(username);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          code: 200
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          code: 400
        });
      }
    } catch (error) {
      console.error('设置管理员用户失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
        error: error
      });
    }
  }

  /**
   * 获取当前管理员列表
   */
  static async getAdminUsers(req: Request, res: Response) {
    try {
      const admins = await InitializationService.getAdminUsers();
      
      res.json({
        success: true,
        message: '获取管理员列表成功',
        code: 200,
        data: admins
      });
    } catch (error) {
      console.error('获取管理员列表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
        error: error
      });
    }
  }

  /**
   * 完成初始化
   */
  static async completeInitialization(req: Request, res: Response) {
    try {
      // 再次检查初始化状态，确保完成
      const status = await InitializationService.checkInitializationStatus();
      
      if (status.isInitialized) {
        res.json({
          success: true,
          message: '系统初始化已完成',
          code: 200,
          data: {
            isInitialized: true,
            redirectTo: '/admin'
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: '系统初始化未完成，请检查是否已设置管理员用户',
          code: 400,
          data: status
        });
      }
    } catch (error) {
      console.error('完成初始化检查失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
        error: error
      });
    }
  }
}