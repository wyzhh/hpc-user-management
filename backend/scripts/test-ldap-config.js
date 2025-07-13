#!/usr/bin/env node

/**
 * LDAP配置测试脚本
 * 用于验证和测试LDAP配置文件
 */

const path = require('path');

// 确保先编译TypeScript代码
try {
  require('../dist/services/ldap');
} catch (error) {
  console.error('请先编译TypeScript代码: npm run build');
  process.exit(1);
}

const { ldapService } = require('../dist/services/ldap');

async function testLdapConfiguration() {
  console.log('🔍 LDAP配置测试工具');
  console.log('====================');
  
  try {
    // 1. 验证配置文件语法
    console.log('\n📋 验证配置文件语法...');
    const validation = await ldapService.validateConfiguration();
    
    if (validation.errors.length > 0) {
      console.log('❌ 配置文件验证失败:');
      validation.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
    } else {
      console.log('✅ 配置文件语法正确');
    }
    
    if (validation.warnings.length > 0) {
      console.log('⚠️  配置警告:');
      validation.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }
    
    // 如果有错误，停止测试
    if (!validation.isValid) {
      console.log('\n❌ 由于配置错误，无法继续测试');
      process.exit(1);
    }
    
    // 2. 测试LDAP连接
    console.log('\n🔗 测试LDAP服务器连接...');
    const connectionResult = await ldapService.testConnection();
    
    if (connectionResult) {
      console.log('✅ LDAP连接测试成功');
    } else {
      console.log('❌ LDAP连接测试失败');
      process.exit(1);
    }
    
    // 3. 测试用户查询
    console.log('\n👥 测试用户查询功能...');
    try {
      const users = await ldapService.getAllUsersWithPosix();
      console.log(`✅ 成功获取 ${users.length} 个用户`);
      
      if (users.length > 0) {
        console.log('   前3个用户示例:');
        users.slice(0, 3).forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.uid} (${user.cn || user.displayName})`);
        });
      }
    } catch (error) {
      console.log('❌ 用户查询测试失败:', error.message);
    }
    
    // 4. 测试认证功能（如果有测试用户配置）
    console.log('\n🔐 测试认证功能...');
    try {
      // 从配置中获取测试用户
      const ldapConfigService = require('../dist/services/LdapConfigService').ldapConfigService;
      const config = await ldapConfigService.loadConfig();
      
      if (config.debug.test_users && config.debug.test_users.length > 0) {
        const testUser = config.debug.test_users[0];
        console.log(`   测试用户: ${testUser.username}`);
        
        // 这里不测试实际密码，只测试用户是否存在
        const user = await ldapService.getUserByUsername(testUser.username);
        if (user) {
          console.log(`✅ 测试用户存在: ${user.uid} (${user.cn})`);
          console.log(`   DN: ${user.dn}`);
          console.log(`   期望DN: ${testUser.expected_dn}`);
          
          if (user.dn === testUser.expected_dn) {
            console.log('✅ DN匹配正确');
          } else {
            console.log('⚠️  DN不匹配，请检查配置');
          }
        } else {
          console.log(`❌ 测试用户不存在: ${testUser.username}`);
        }
      } else {
        console.log('   ⏭️  未配置测试用户，跳过认证测试');
        console.log('   💡 可在ldap.yaml的debug.test_users中配置测试用户');
      }
    } catch (error) {
      console.log('❌ 认证功能测试失败:', error.message);
    }
    
    console.log('\n🎉 LDAP配置测试完成！');
    
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 命令行参数处理
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
LDAP配置测试工具

用法:
  node scripts/test-ldap-config.js [选项]

选项:
  --help, -h    显示帮助信息

功能:
  1. 验证LDAP配置文件语法
  2. 测试LDAP服务器连接
  3. 测试用户查询功能
  4. 测试认证功能（如果配置了测试用户）

配置文件位置:
  backend/config/ldap.yaml

示例:
  npm run test-ldap     # 使用package.json脚本
  node scripts/test-ldap-config.js
    `);
    process.exit(0);
  }
  
  testLdapConfiguration().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testLdapConfiguration };