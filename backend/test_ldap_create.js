const { ldapService } = require('./dist/services/ldap');

async function testCreateStudentAccount() {
  console.log('=== 测试LDAP学生账号创建功能 ===\n');
  
  // 测试数据
  const studentData = {
    username: 'testuser456',
    chinese_name: '测试学生456',
    email: 'testuser456@example.com',
    phone: '13800138001',
    password: 'testpassword123'
  };
  
  const piId = 6; // 使用现有的PI ID
  
  try {
    console.log('1. 获取下一个可用的UID...');
    const uid = await ldapService.getNextAvailableUID();
    console.log(`   下一个可用UID: ${uid}`);
    
    console.log('\n2. 获取PI的GID...');
    const gid = await ldapService.getPIGID(piId);
    console.log(`   PI的GID: ${gid}`);
    
    console.log('\n3. 获取学生home目录基础路径...');
    const homeBase = await ldapService.getStudentHomeBaseDirectory(piId);
    console.log(`   home目录基础路径: ${homeBase}`);
    console.log(`   学生home目录将为: ${homeBase}/${studentData.username}`);
    
    console.log('\n4. 创建LDAP学生账号...');
    const userDN = await ldapService.createStudentAccount(studentData, piId);
    console.log(`   ✅ 学生账号创建成功!`);
    console.log(`   用户DN: ${userDN}`);
    
    console.log('\n5. 验证账号是否可以认证...');
    const user = await ldapService.getUserByUsername(studentData.username);
    if (user) {
      console.log('   ✅ 账号验证成功!');
      console.log(`   用户信息: ${JSON.stringify(user, null, 2)}`);
    } else {
      console.log('   ❌ 账号验证失败');
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 运行测试
testCreateStudentAccount().then(() => {
  console.log('\n测试脚本执行完成');
  process.exit(0);
}).catch((error) => {
  console.error('测试脚本执行失败:', error);
  process.exit(1);
});