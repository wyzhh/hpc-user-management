const { StudentModel, PIModel } = require('./dist/models');

async function testSmartSync() {
  console.log('=== 测试智能同步功能 ===\n');
  
  try {
    // 1. 测试检查本地修改字段功能
    console.log('1. 测试学生本地修改字段检查...');
    const studentLocalFields = await StudentModel.getLocallyModifiedFields('zyqgroup01');
    console.log(`   学生zyqgroup01的本地修改字段: [${studentLocalFields.join(', ')}]`);
    
    console.log('\n2. 测试PI本地修改字段检查...');
    const piLocalFields = await PIModel.getLocallyModifiedFields('ztron');
    console.log(`   PI ztron的本地修改字段: [${piLocalFields.join(', ')}]`);
    
    // 2. 测试智能更新功能
    console.log('\n3. 测试学生智能更新...');
    const studentResult = await StudentModel.smartUpdate('zyqgroup01', {
      full_name: '来自LDAP的新全名',
      email: 'ldap_new_email@example.com',
      phone: '13899999999'
    }, studentLocalFields);
    
    if (studentResult) {
      console.log(`   ✅ 学生智能更新成功: ${studentResult.username}`);
      console.log(`   保护的本地字段: [${studentLocalFields.join(', ')}]`);
    } else {
      console.log('   ❌ 学生智能更新失败');
    }
    
    console.log('\n4. 测试PI智能更新...');
    const piResult = await PIModel.smartUpdate('ztron', {
      full_name: '来自LDAP的新全名',
      email: 'ldap_pi_email@example.com',
      department: '来自LDAP的新部门'
    }, piLocalFields);
    
    if (piResult) {
      console.log(`   ✅ PI智能更新成功: ${piResult.username}`);
      console.log(`   保护的本地字段: [${piLocalFields.join(', ')}]`);
    } else {
      console.log('   ❌ PI智能更新失败');
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 运行测试
testSmartSync().then(() => {
  console.log('\n测试脚本执行完成');
  process.exit(0);
}).catch((error) => {
  console.error('测试脚本执行失败:', error);
  process.exit(1);
});