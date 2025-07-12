#!/usr/bin/env node
/**
 * LDAP配置检查工具
 * 使用方法: node scripts/check-ldap-config.js
 */

require('dotenv').config();

function checkLDAPConfig() {
  console.log('='.repeat(50));
  console.log('LDAP配置检查');
  console.log('='.repeat(50));

  const requiredVars = [
    'LDAP_URL',
    'LDAP_BIND_DN', 
    'LDAP_BIND_PASSWORD',
    'LDAP_BASE_DN'
  ];

  const optionalVars = [
    'LDAP_PI_OU',
    'LDAP_STUDENT_OU',
    'LDAP_GROUPS_OU',
    'LDAP_CONNECT_TIMEOUT',
    'LDAP_TIMEOUT',
    'LDAP_IDLE_TIMEOUT',
    'LDAP_TLS_ENABLED',
    'LDAP_TLS_REJECT_UNAUTHORIZED',
    'LDAP_SEARCH_SCOPE',
    'LDAP_PI_SEARCH_FILTER',
    'LDAP_STUDENT_SEARCH_FILTER'
  ];

  console.log('\n必需配置项:');
  console.log('-'.repeat(30));
  let hasError = false;
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`❌ ${varName}: 未设置`);
      hasError = true;
    }
  });

  console.log('\n可选配置项:');
  console.log('-'.repeat(30));
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚠️  ${varName}: 使用默认值`);
    }
  });

  console.log('\n属性映射配置:');
  console.log('-'.repeat(30));
  const attributeVars = [
    'LDAP_PI_USERNAME_ATTR',
    'LDAP_PI_NAME_ATTR', 
    'LDAP_PI_EMAIL_ATTR',
    'LDAP_PI_PHONE_ATTR',
    'LDAP_PI_DEPARTMENT_ATTR',
    'LDAP_PI_CN_ATTR',
    'LDAP_STUDENT_USERNAME_ATTR',
    'LDAP_STUDENT_NAME_ATTR',
    'LDAP_STUDENT_EMAIL_ATTR',
    'LDAP_STUDENT_PHONE_ATTR'
  ];

  attributeVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚠️  ${varName}: 使用默认值`);
    }
  });

  console.log('\n配置验证:');
  console.log('-'.repeat(30));
  
  // 检查URL格式
  const ldapUrl = process.env.LDAP_URL;
  if (ldapUrl) {
    if (ldapUrl.startsWith('ldap://') || ldapUrl.startsWith('ldaps://')) {
      console.log('✅ LDAP URL格式正确');
    } else {
      console.log('❌ LDAP URL格式错误，应以ldap://或ldaps://开头');
      hasError = true;
    }
  }

  // 检查DN格式
  const bindDN = process.env.LDAP_BIND_DN;
  const baseDN = process.env.LDAP_BASE_DN;
  if (bindDN && baseDN) {
    if (bindDN.includes('dc=') && baseDN.includes('dc=')) {
      console.log('✅ DN格式看起来正确');
    } else {
      console.log('⚠️  DN格式可能不标准，请确认是否正确');
    }
  }

  console.log('\n'.repeat(2));
  if (hasError) {
    console.log('❌ 配置检查失败！请修复上述错误。');
    process.exit(1);
  } else {
    console.log('✅ 配置检查通过！');
    process.exit(0);
  }
}

if (require.main === module) {
  checkLDAPConfig();
}

module.exports = { checkLDAPConfig };