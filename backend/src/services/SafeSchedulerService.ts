import * as cron from 'node-cron';
import { SafeSyncService } from './SafeSyncService';

/**
 * 安全调度服务 - 使用新的安全同步逻辑
 */
export class SafeSchedulerService {
  private static tasks: Map<string, cron.ScheduledTask> = new Map();

  /**
   * 启动安全同步任务
   */
  static startSafeTasks() {
    console.log('🛡️ 启动安全同步任务...');

    // 每5分钟执行安全同步
    this.scheduleSafeSync();
    
    // 每天凌晨2点执行完整同步（包含清理操作）
    this.scheduleFullCleanupSync();

    console.log('✅ 安全同步任务已启动');
    console.log('   🛡️ 安全同步: 每5分钟（只同步LDAP权威字段）');
    console.log('   🧹 完整清理: 每天凌晨2点（包含用户清理操作）');
  }

  /**
   * 调度安全同步任务 - 每5分钟
   */
  static scheduleSafeSync() {
    // 每5分钟执行安全同步
    const task = cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('🛡️ 开始执行5分钟安全同步任务...');
        const syncResult = await SafeSyncService.performSafeSync();

        console.log('✅ 5分钟安全同步任务执行完成:', {
          new_users: syncResult.users.new_users,
          updated_users: syncResult.users.updated_users,
          protected_fields: syncResult.users.protected_fields
        });
      } catch (error) {
        console.error('❌ 5分钟安全同步任务执行失败:', error);
      }
    }, {
      timezone: 'Asia/Shanghai'
    });

    this.tasks.set('safeSync', task);
    task.start();
    console.log('🛡️ 安全同步定时任务已调度: 每5分钟执行');
  }

  /**
   * 调度完整清理同步任务 - 每天凌晨2点
   */
  static scheduleFullCleanupSync() {
    // 每天凌晨2点执行完整同步（包含用户清理）
    const task = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 开始执行每日完整清理同步任务...');
        const syncResult = await SafeSyncService.performSafeSync();

        console.log('✅ 每日完整清理同步任务执行完成:', syncResult);
      } catch (error) {
        console.error('❌ 每日完整清理同步任务执行失败:', error);
      }
    }, {
      timezone: 'Asia/Shanghai'
    });

    this.tasks.set('fullCleanupSync', task);
    task.start();
    console.log('🧹 完整清理同步定时任务已调度: 每天凌晨2点执行');
  }

  /**
   * 立即执行安全同步（用于手动触发）
   */
  static async executeSafeSyncNow(): Promise<any> {
    try {
      console.log('🛡️ 手动触发安全同步任务...');
      const syncResult = await SafeSyncService.performSafeSync();

      console.log('✅ 手动安全同步任务执行完成:', syncResult);
      return syncResult;
    } catch (error) {
      console.error('❌ 手动安全同步任务执行失败:', error);
      throw error;
    }
  }

  /**
   * 停止所有任务
   */
  static stopAllTasks() {
    console.log('⏹️ 停止安全同步任务...');
    
    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`定时任务 ${name} 已停止`);
    });
    
    this.tasks.clear();
    console.log('所有安全同步任务已停止');
  }

  /**
   * 获取同步状态
   */
  static async getSyncStatus(): Promise<any> {
    return await SafeSyncService.getSyncStatus();
  }
}

export const safeSchedulerService = new SafeSchedulerService();
export default safeSchedulerService;