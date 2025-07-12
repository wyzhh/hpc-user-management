import * as cron from 'node-cron';
import config from '../config';
import { SyncService } from './sync';
import { AuditService } from './audit';

export class SchedulerService {
  private static tasks: Map<string, cron.ScheduledTask> = new Map();

  // 启动所有定时任务
  static startAllTasks() {
    console.log('📅 启动定时同步任务...');

    // 每日凌晨2点执行完全同步
    this.scheduleFullSync();

    // 每10分钟执行增量同步
    this.scheduleIncrementalSync();

    console.log('✅ 所有定时同步任务已启动');
    console.log('   📊 完全同步: 每天凌晨2点');
    console.log('   ⚡ 增量同步: 每10分钟');
    console.log('   🚀 启动同步: 启动后1秒执行');
  }

  // 智能启动同步：检查是否需要同步
  static async smartStartupSync(): Promise<void> {
    try {
      console.log('🔍 检查是否需要执行启动同步...');
      
      // 检查是否需要同步（比如检查上次同步时间）
      const needsSync = await this.shouldSyncOnStartup();
      
      if (needsSync) {
        console.log('🔄 检测到需要同步，开始执行启动同步...');
        const syncResult = await this.executeFullSyncNow();
        console.log('✅ 启动同步完成:', syncResult);
      } else {
        console.log('ℹ️ 无需执行启动同步');
      }
    } catch (error) {
      console.error('❌ 启动同步检查失败:', error);
    }
  }

  // 判断是否需要在启动时同步
  private static async shouldSyncOnStartup(): Promise<boolean> {
    try {
      // 策略1: 如果环境变量明确禁用，则不同步
      if (process.env.SYNC_ON_STARTUP === 'false') {
        return false;
      }

      // 策略2: 默认启动时总是同步（按照你的需求）
      if (process.env.SYNC_ON_STARTUP === 'true') {
        console.log('🔄 环境变量启用启动时同步');
        return true;
      }

      // 策略3: 默认行为 - 启动时总是同步
      console.log('🔄 启动时默认执行同步');
      return true;
    } catch (error) {
      console.error('判断是否需要同步时出错:', error);
      // 出错时默认同步，确保数据一致性
      return true;
    }
  }

  // 检查数据库是否为空
  private static async isDatabaseEmpty(): Promise<boolean> {
    try {
      // 这里需要导入数据库模型
      const { PIModel, StudentModel } = await import('../models');
      
      const piResult = await PIModel.getAll(1, 1, false);
      const studentResult = await StudentModel.getAll(1, 1);
      
      return piResult.total === 0 && studentResult.total === 0;
    } catch (error) {
      console.error('检查数据库是否为空时出错:', error);
      return false;
    }
  }

  // 停止所有定时任务
  static stopAllTasks() {
    console.log('停止定时同步任务...');
    
    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`定时任务 ${name} 已停止`);
    });
    
    this.tasks.clear();
    console.log('所有定时同步任务已停止');
  }

  // 调度完全同步任务
  static scheduleFullSync() {
    // 每天凌晨2点执行完全同步
    const task = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('开始执行定时完全同步任务...');
        const syncResult = await SyncService.syncAllUsers();

        // 记录审计日志
        await SyncService.logSyncAudit(syncResult, 0); // 系统任务，performerId为0

        await AuditService.logAction(
          'scheduled_full_sync',
          'system',
          0,
          { 
            sync_result: syncResult,
            scheduled_time: new Date().toISOString()
          }
        );

        console.log('定时完全同步任务执行完成:', syncResult);
      } catch (error) {
        console.error('定时完全同步任务执行失败:', error);
        
        try {
          await AuditService.logAction(
            'scheduled_sync_error',
            'system',
            0,
            { 
              error: error.message,
              sync_type: 'full_sync',
              scheduled_time: new Date().toISOString()
            }
          );
        } catch (auditError) {
          console.error('记录定时同步错误审计日志失败:', auditError);
        }
      }
    }, {
      timezone: 'Asia/Shanghai'
    });

    this.tasks.set('fullSync', task);
    task.start();
    console.log('完全同步定时任务已调度: 每天凌晨2点执行');
  }

  // 调度增量同步任务
  static scheduleIncrementalSync() {
    // 每10分钟执行增量同步
    const task = cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('开始执行定时增量同步任务...');
        
        // 获取上次同步时间（可以从配置或数据库中获取）
        const lastSyncTime = await this.getLastSyncTime();
        const syncResult = await SyncService.incrementalSync(lastSyncTime);

        // 更新最后同步时间
        await this.updateLastSyncTime(new Date());

        // 记录审计日志
        await SyncService.logSyncAudit(syncResult, 0);

        await AuditService.logAction(
          'scheduled_incremental_sync',
          'system',
          0,
          { 
            sync_result: syncResult,
            last_sync_time: lastSyncTime?.toISOString(),
            scheduled_time: new Date().toISOString()
          }
        );

        console.log('定时增量同步任务执行完成:', syncResult);
      } catch (error) {
        console.error('定时增量同步任务执行失败:', error);
        
        try {
          await AuditService.logAction(
            'scheduled_sync_error',
            'system',
            0,
            { 
              error: error.message,
              sync_type: 'incremental_sync',
              scheduled_time: new Date().toISOString()
            }
          );
        } catch (auditError) {
          console.error('记录定时同步错误审计日志失败:', auditError);
        }
      }
    }, {
      timezone: 'Asia/Shanghai'
    });

    this.tasks.set('incrementalSync', task);
    // 自动启动增量同步任务
    task.start();
    console.log('增量同步定时任务已调度: 每10分钟执行');
  }

  // 手动启动特定任务
  static startTask(taskName: string): boolean {
    const task = this.tasks.get(taskName);
    if (task) {
      task.start();
      console.log(`定时任务 ${taskName} 已启动`);
      return true;
    }
    console.error(`定时任务 ${taskName} 不存在`);
    return false;
  }

  // 手动停止特定任务
  static stopTask(taskName: string): boolean {
    const task = this.tasks.get(taskName);
    if (task) {
      task.stop();
      console.log(`定时任务 ${taskName} 已停止`);
      return true;
    }
    console.error(`定时任务 ${taskName} 不存在`);
    return false;
  }

  // 获取任务状态
  static getTaskStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    this.tasks.forEach((task, name) => {
      // 由于node-cron没有running属性，我们简单返回true表示任务已调度
      status[name] = true;
    });
    return status;
  }


  // 获取上次同步时间（简化实现，实际应该从数据库获取）
  private static async getLastSyncTime(): Promise<Date | undefined> {
    try {
      // 这里应该从数据库或配置文件中获取上次同步时间
      // 简化实现：返回24小时前
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      return oneDayAgo;
    } catch (error) {
      console.error('获取上次同步时间失败:', error);
      return undefined;
    }
  }

  // 更新最后同步时间（简化实现，实际应该保存到数据库）
  private static async updateLastSyncTime(syncTime: Date): Promise<void> {
    try {
      // 这里应该将同步时间保存到数据库或配置文件
      console.log(`更新最后同步时间: ${syncTime.toISOString()}`);
    } catch (error) {
      console.error('更新最后同步时间失败:', error);
    }
  }

  // 立即执行完全同步（用于手动触发）
  static async executeFullSyncNow(): Promise<any> {
    try {
      console.log('手动触发完全同步任务...');
      const syncResult = await SyncService.syncAllUsers();

      await SyncService.logSyncAudit(syncResult, 0);
      await AuditService.logAction(
        'manual_full_sync',
        'system',
        0,
        { 
          sync_result: syncResult,
          trigger_time: new Date().toISOString()
        }
      );

      console.log('手动完全同步任务执行完成:', syncResult);
      return syncResult;
    } catch (error) {
      console.error('手动完全同步任务执行失败:', error);
      throw error;
    }
  }

  // 立即执行增量同步（用于手动触发）
  static async executeIncrementalSyncNow(): Promise<any> {
    try {
      console.log('手动触发增量同步任务...');
      const lastSyncTime = await this.getLastSyncTime();
      const syncResult = await SyncService.incrementalSync(lastSyncTime);

      await this.updateLastSyncTime(new Date());
      await SyncService.logSyncAudit(syncResult, 0);
      await AuditService.logAction(
        'manual_incremental_sync',
        'system',
        0,
        { 
          sync_result: syncResult,
          last_sync_time: lastSyncTime?.toISOString(),
          trigger_time: new Date().toISOString()
        }
      );

      console.log('手动增量同步任务执行完成:', syncResult);
      return syncResult;
    } catch (error) {
      console.error('手动增量同步任务执行失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
export const schedulerService = new SchedulerService();
export default schedulerService;