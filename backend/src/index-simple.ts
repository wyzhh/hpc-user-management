import express from 'express';
import cors from 'cors';
import config from './config';
import testRoutes from './routes/test';

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// 测试路由
app.use('/test', testRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const server = app.listen(config.port, () => {
  console.log(`🚀 服务器启动成功: http://localhost:${config.port}`);
});

export default app;