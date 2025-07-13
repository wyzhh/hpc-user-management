import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config';
import apiRoutes from './routes';
import { testConnection } from './config/database';
import { ldapService } from './services/ldap';
import { SchedulerService } from './services/scheduler';
import { SafeSchedulerService } from './services/SafeSchedulerService';
import { InitializationService } from './services/InitializationService';

const app = express();

// 中间件配置
app.use(helmet()); // 安全头部
app.use(compression()); // 响应压缩

// CORS配置
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// 请求日志
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 一般API的速率限制
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 300, // 增加到300个请求
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    code: 429,
  },
});

// 对check-username接口的宽松限制
const checkUsernameLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 30, // 每分钟最多30个检查请求
  message: {
    success: false,
    message: '用户名检查请求过于频繁，请稍后再试',
    code: 429,
  },
});

// 对初始化接口的宽松限制  
const initLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 50, // 每分钟最多50个请求
  message: {
    success: false,
    message: '初始化请求过于频繁，请稍后再试',
    code: 429,
  },
});

// 应用不同的限制策略
app.use('/api/students/check-username', checkUsernameLimiter);
app.use('/api/initialization', initLimiter);
app.use('/api', generalLimiter);

// 解析请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HPC用户管理系统运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API路由
app.use('/api', apiRoutes);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    code: 404,
  });
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('错误:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: config.nodeEnv === 'production' ? '服务器内部错误' : err.message,
    code: err.status || 500,
  });
});

// 启动服务器
const server = app.listen(config.port, async () => {
  console.log(`🚀 HPC用户管理系统服务器启动成功`);
  console.log(`📡 服务器地址: http://localhost:${config.port}`);
  console.log(`🌍 环境: ${config.nodeEnv}`);
  console.log(`📊 健康检查: http://localhost:${config.port}/health`);
  
  // 测试数据库连接
  await testConnection();
  
  // 测试LDAP连接
  await ldapService.testConnection();
  
  // 检查系统初始化状态
  console.log('🔍 检查系统初始化状态...');
  const initStatus = await InitializationService.checkInitializationStatus();
  
  if (!initStatus.isInitialized) {
    console.log('⚠️  系统尚未初始化');
    console.log(`📋 状态: ${initStatus.message}`);
    console.log('🌐 请访问 http://localhost:3001/initialization 进行系统初始化');
  } else {
    console.log('✅ 系统已完成初始化');
    
    // 只有在系统已初始化的情况下才启动定时同步任务
    if (config.nodeEnv !== 'test') {
      // 启用新的安全同步任务
      SafeSchedulerService.startSafeTasks();
      
      console.log('🛡️ 系统已启用安全同步模式');
      console.log('📢 本地业务数据受到保护，只有LDAP权威字段会被同步');
    }
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  SchedulerService.stopAllTasks();
  SafeSchedulerService.stopAllTasks();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  SchedulerService.stopAllTasks();
  SafeSchedulerService.stopAllTasks();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

export default app;