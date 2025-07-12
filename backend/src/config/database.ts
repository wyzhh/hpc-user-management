import { Pool } from 'pg';
import config from './index';

// 解析数据库URL
const parseDbUrl = (url: string) => {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid database URL format');
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
};

const dbConfig = parseDbUrl(config.database.url!);

// 创建连接池
export const pool = new Pool({
  ...dbConfig,
  host: '127.0.0.1', // 强制使用IPv4
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时时间
  connectionTimeoutMillis: 2000, // 连接超时时间
  ssl: false, // 禁用SSL
});

// 监听连接事件
pool.on('connect', () => {
  console.log('📊 数据库连接成功');
});

pool.on('error', (err) => {
  console.error('💥 数据库连接错误:', err);
  process.exit(-1);
});

// 测试数据库连接
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ 数据库连接测试成功:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ 数据库连接测试失败:', error);
    return false;
  }
};

// 优雅关闭连接池
export const closePool = async (): Promise<void> => {
  try {
    await pool.end();
    console.log('🔌 数据库连接池已关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接池时发生错误:', error);
  }
};

export default pool;