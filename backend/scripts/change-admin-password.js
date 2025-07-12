#!/usr/bin/env node
/**
 * 管理员密码修改工具
 * 使用方法: node scripts/change-admin-password.js <username> <new-password>
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function changeAdminPassword(username, newPassword) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const hash = bcrypt.hashSync(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE admins SET password_hash = $1 WHERE username = $2',
      [hash, username]
    );

    if (result.rowCount > 0) {
      console.log(`✅ 管理员 ${username} 密码已更新`);
    } else {
      console.log(`❌ 管理员 ${username} 不存在`);
    }
  } catch (error) {
    console.error('❌ 密码更新失败:', error.message);
  } finally {
    await pool.end();
  }
}

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.log('使用方法: node scripts/change-admin-password.js <username> <new-password>');
  console.log('示例: node scripts/change-admin-password.js admin new-secure-password');
  process.exit(1);
}

changeAdminPassword(username, password);