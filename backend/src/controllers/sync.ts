import { Request, Response } from 'express';
import { SafeSyncService } from '../services/SafeSyncService';
import { SafeSchedulerService } from '../services/SafeSchedulerService';

export class SyncController {
  
  /**
   * 执行安全同步
   */
  static async performSafeSync(req: Request, res: Response) {
    try {
      console.log('🛡️ 管理员手动触发安全同步...');
      
      const result = await SafeSchedulerService.executeSafeSyncNow();
      
      res.json({
        success: true,
        message: '安全同步完成',
        data: result
      });
    } catch (error) {
      console.error('❌ 安全同步失败:', error);
      res.status(500).json({
        success: false,
        message: '安全同步失败',
        error: error.message
      });
    }
  }

  /**
   * 获取同步状态
   */
  static async getSyncStatus(req: Request, res: Response) {
    try {
      const status = await SafeSchedulerService.getSyncStatus();
      
      res.json({
        success: true,
        data: {
          ...status,
          sync_mode: 'safe',
          protection_info: {
            protected_fields: ['full_name', 'email', 'phone', 'user_type'],
            ldap_fields: ['ldap_dn', 'uid_number', 'gid_number', 'home_directory', 'login_shell'],
            last_update: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      console.error('❌ 获取同步状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取同步状态失败',
        error: error.message
      });
    }
  }

  /**
   * 检查用户的保护字段
   */
  static async checkUserProtection(req: Request, res: Response) {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          message: '用户名不能为空'
        });
      }

      const protectedFields = await SafeSyncService.checkProtectedFields(username);
      
      res.json({
        success: true,
        data: {
          username,
          protected_fields: protectedFields,
          protection_status: protectedFields.length > 0 ? 'protected' : 'no_protection_needed',
          message: protectedFields.length > 0 
            ? `用户 ${username} 的 ${protectedFields.length} 个字段受到保护`
            : `用户 ${username} 无需字段保护`
        }
      });
    } catch (error) {
      console.error('❌ 检查用户保护状态失败:', error);
      res.status(500).json({
        success: false,
        message: '检查用户保护状态失败',
        error: error.message
      });
    }
  }
}

export default SyncController;