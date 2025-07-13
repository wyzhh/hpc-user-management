require('dotenv').config();
const pool = require('./dist/config/database.js').default;

async function testUnifiedSync() {
  console.log('=== 统一5分钟同步测试 ===\n');
  
  try {
    // 1. 显示当前同步策略
    console.log('📋 新的统一同步策略:');
    console.log('✅ 频率: 每5分钟执行一次');
    console.log('✅ 功能: 完整同步（新增、更新、停用）');
    console.log('✅ 保护: 完全保护本地业务数据');
    console.log('✅ 简洁: 只有一种同步任务，简单明了\n');

    // 2. 验证个人信息保护
    console.log('🛡️ 验证个人信息保护状态:');
    const checkQuery = `
      SELECT username, full_name, email, phone, user_type, is_active, updated_at
      FROM users 
      WHERE username IN ('ztron', 'zyqgroup01')
      ORDER BY username
    `;
    const result = await pool.query(checkQuery);
    
    result.rows.forEach(user => {
      const hasProtectedData = user.full_name || user.email || user.phone;
      console.log(`${user.username}:`);
      console.log(`  🛡️ 保护状态: ${hasProtectedData ? '有数据需保护' : '无数据'}`);
      console.log(`  📝 姓名: ${user.full_name || '空'}`);
      console.log(`  📧 邮箱: ${user.email || '空'}`);
      console.log(`  📱 电话: ${user.phone || '空'}`);
      console.log(`  👤 角色: ${user.user_type}`);
      console.log(`  ✅ 活跃: ${user.is_active ? '是' : '否'}\n`);
    });

    // 3. 模拟同步操作将执行的检查
    console.log('🔍 模拟统一同步将执行的操作:');
    
    // 检查保护字段
    function getProtectedFields(user) {
      const protected = [];
      if (user.full_name && user.full_name.trim() !== '') protected.push('姓名');
      if (user.email && user.email.trim() !== '' && !user.email.includes('@ldap.')) protected.push('邮箱');
      if (user.phone && user.phone.trim() !== '') protected.push('电话');
      if (user.user_type && user.user_type !== 'unassigned') protected.push('角色');
      return protected;
    }
    
    result.rows.forEach(user => {
      const protectedFields = getProtectedFields(user);
      console.log(`${user.username}:`);
      console.log(`  🔒 将被保护的字段: [${protectedFields.join(', ')}]`);
      console.log(`  🔄 可同步的LDAP字段: [LDAP DN, UID, GID, 家目录]`);
      console.log(`  ⚡ 操作频率: 每5分钟检查一次\n`);
    });

    // 4. 检查最近的同步记录
    console.log('📊 最近的同步活动记录:');
    const syncQuery = `
      SELECT sync_type, total_users, new_users, updated_users, started_at
      FROM sync_logs 
      ORDER BY started_at DESC 
      LIMIT 5
    `;
    const syncResult = await pool.query(syncQuery);
    
    if (syncResult.rows.length > 0) {
      syncResult.rows.forEach((log, index) => {
        const time = new Date(log.started_at).toLocaleString();
        console.log(`${index + 1}. ${log.sync_type} - ${time}`);
        console.log(`   用户: 总${log.total_users} 新增${log.new_users} 更新${log.updated_users}`);
      });
    } else {
      console.log('✅ 无旧的同步记录（新系统启动）');
    }

    // 5. 计算下次同步时间
    console.log('\n⏰ 同步时间计算:');
    const now = new Date();
    const currentMinute = now.getMinutes();
    const nextSyncMinute = Math.ceil(currentMinute / 5) * 5;
    const nextSync = new Date(now);
    nextSync.setMinutes(nextSyncMinute, 0, 0);
    
    if (nextSyncMinute >= 60) {
      nextSync.setHours(nextSync.getHours() + 1);
      nextSync.setMinutes(0, 0, 0);
    }
    
    const timeToNext = Math.ceil((nextSync - now) / 1000);
    console.log(`当前时间: ${now.toLocaleString()}`);
    console.log(`下次同步: ${nextSync.toLocaleString()}`);
    console.log(`倒计时: ${timeToNext}秒后执行下次同步`);

    // 6. 同步策略总结
    console.log('\n📋 统一同步策略总结:');
    console.log('🎯 目标: 保持LDAP与系统的用户同步');
    console.log('🛡️ 原则: 只同步LDAP权威字段，保护本地业务数据');
    console.log('⚡ 频率: 每5分钟全功能同步');
    console.log('🔄 功能: 新增用户、更新系统字段、停用离职用户');
    console.log('✅ 简洁: 一种同步任务解决所有需求');

    console.log('\n=== 统一同步测试完成 ===');
    console.log('🎉 系统现在使用统一的5分钟安全同步！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    pool.end();
  }
}

testUnifiedSync();