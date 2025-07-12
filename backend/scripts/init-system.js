#!/usr/bin/env node
/**
 * HPC用户管理系统初始化脚本
 * 检查和初始化数据库、LDAP连接、管理员用户等
 * 使用方法: node scripts/init-system.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const ldap = require('ldapjs');

class SystemInitializer {
  constructor() {
    this.dbPool = null;
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅', 
      warning: '⚠️ ',
      error: '❌'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    if (type === 'error') this.errors.push(message);
    if (type === 'warning') this.warnings.push(message);
  }

  async checkEnvironmentVariables() {
    this.log('检查环境变量配置...', 'info');
    
    const required = [
      'DATABASE_URL',
      'LDAP_URL', 
      'LDAP_BIND_DN',
      'LDAP_BIND_PASSWORD',
      'LDAP_BASE_DN',
      'JWT_SECRET'
    ];

    for (const envVar of required) {
      if (!process.env[envVar]) {
        this.log(`缺少必需的环境变量: ${envVar}`, 'error');
      } else {
        this.log(`${envVar}: 已配置`, 'success');
      }
    }

    const optional = [
      'LDAP_PI_OU',
      'LDAP_STUDENT_OU', 
      'LDAP_ADMIN_USERS'
    ];

    for (const envVar of optional) {
      if (!process.env[envVar]) {
        this.log(`可选环境变量 ${envVar}: 使用默认值`, 'warning');
      } else {
        this.log(`${envVar}: ${process.env[envVar]}`, 'success');
      }
    }
  }

  async checkDatabaseConnection() {
    this.log('检查数据库连接...', 'info');
    
    try {
      this.dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: false
      });

      const client = await this.dbPool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      
      this.log(`数据库连接成功: ${result.rows[0].now}`, 'success');
      return true;
    } catch (error) {
      this.log(`数据库连接失败: ${error.message}`, 'error');
      return false;
    }
  }

  async checkAndCreateTables() {
    this.log('检查和创建数据库表...', 'info');
    
    const tables = {
      pis: `
        CREATE TABLE IF NOT EXISTS pis (
          id SERIAL PRIMARY KEY,
          ldap_dn VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(100) UNIQUE NOT NULL,
          full_name VARCHAR(200) NOT NULL,
          email VARCHAR(255) NOT NULL,
          department VARCHAR(200),
          phone VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
      
      students: `
        CREATE TABLE IF NOT EXISTS students (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          chinese_name VARCHAR(200) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          pi_id INTEGER REFERENCES pis(id) ON DELETE CASCADE,
          ldap_dn VARCHAR(255),
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'deleted')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
      
      requests: `
        CREATE TABLE IF NOT EXISTS requests (
          id SERIAL PRIMARY KEY,
          pi_id INTEGER REFERENCES pis(id) ON DELETE CASCADE,
          request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('create', 'delete')),
          student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
          student_data JSONB,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          reason TEXT,
          admin_id INTEGER,
          requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reviewed_at TIMESTAMP
        )`,
      
      admins: `
        CREATE TABLE IF NOT EXISTS admins (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          full_name VARCHAR(200) NOT NULL,
          email VARCHAR(255) NOT NULL,
          ldap_dn VARCHAR(255),
          role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
      
      audit_logs: `
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          request_id INTEGER REFERENCES requests(id) ON DELETE SET NULL,
          action VARCHAR(50) NOT NULL,
          performer_type VARCHAR(20) NOT NULL CHECK (performer_type IN ('pi', 'admin', 'system')),
          performer_id INTEGER NOT NULL,
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    };

    for (const [tableName, sql] of Object.entries(tables)) {
      try {
        await this.dbPool.query(sql);
        this.log(`表 ${tableName} 创建/检查完成`, 'success');
      } catch (error) {
        this.log(`表 ${tableName} 创建失败: ${error.message}`, 'error');
      }
    }
  }

  async checkLDAPConnection() {
    this.log('检查LDAP连接...', 'info');
    
    return new Promise((resolve) => {
      const client = ldap.createClient({
        url: process.env.LDAP_URL,
        timeout: 10000,
        connectTimeout: 10000
      });

      client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_PASSWORD, (err) => {
        if (err) {
          this.log(`LDAP连接失败: ${err.message}`, 'error');
          resolve(false);
        } else {
          this.log('LDAP连接成功', 'success');
          client.unbind();
          resolve(true);
        }
      });

      client.on('error', (err) => {
        this.log(`LDAP连接错误: ${err.message}`, 'error');
        resolve(false);
      });
    });
  }

  async checkLDAPStructure() {
    this.log('检查LDAP组织结构...', 'info');
    
    const baseDN = process.env.LDAP_BASE_DN;
    const piOU = process.env.LDAP_PI_OU || 'ou=pis';
    const studentOU = process.env.LDAP_STUDENT_OU || 'ou=students';
    
    const checkOU = (ou, name) => {
      return new Promise((resolve) => {
        const client = ldap.createClient({ url: process.env.LDAP_URL });
        
        client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_PASSWORD, (err) => {
          if (err) {
            this.log(`LDAP绑定失败: ${err.message}`, 'error');
            resolve(false);
            return;
          }

          const searchDN = `${ou},${baseDN}`;
          client.search(searchDN, { scope: 'base' }, (err, res) => {
            if (err) {
              this.log(`${name} OU不存在: ${searchDN}`, 'warning');
              resolve(false);
              return;
            }

            let found = false;
            res.on('searchEntry', () => {
              found = true;
            });

            res.on('end', () => {
              if (found) {
                this.log(`${name} OU存在: ${searchDN}`, 'success');
              } else {
                this.log(`${name} OU不存在: ${searchDN}`, 'warning');
              }
              client.unbind();
              resolve(found);
            });
          });
        });
      });
    };

    await checkOU(piOU, 'PI用户');
    await checkOU(studentOU, '学生用户');
  }

  async createLDAPAdmins() {
    this.log('处理LDAP管理员用户...', 'info');
    
    const ldapAdminUsers = process.env.LDAP_ADMIN_USERS;
    if (!ldapAdminUsers) {
      this.log('未配置LDAP管理员用户 (LDAP_ADMIN_USERS)', 'warning');
      return;
    }

    const adminUsernames = ldapAdminUsers.split(',').map(u => u.trim());
    
    for (const username of adminUsernames) {
      await this.createAdminFromLDAP(username);
    }
  }

  async createAdminFromLDAP(username) {
    return new Promise((resolve) => {
      const client = ldap.createClient({ url: process.env.LDAP_URL });
      
      client.bind(process.env.LDAP_BIND_DN, process.env.LDAP_BIND_PASSWORD, (err) => {
        if (err) {
          this.log(`LDAP绑定失败: ${err.message}`, 'error');
          resolve(false);
          return;
        }

        const baseDN = process.env.LDAP_BASE_DN;
        const searchFilter = `(uid=${username})`;
        
        client.search(baseDN, { 
          scope: 'sub',
          filter: searchFilter,
          attributes: ['uid', 'cn', 'displayName', 'mail']
        }, (err, res) => {
          if (err) {
            this.log(`搜索LDAP用户失败: ${username}`, 'error');
            resolve(false);
            return;
          }

          let userInfo = null;
          
          res.on('searchEntry', (entry) => {
            const attrs = entry.attributes;
            const getAttr = (name) => {
              const attr = attrs.find(a => a.type === name);
              return attr ? attr.values[0] : '';
            };

            userInfo = {
              username: getAttr('uid'),
              full_name: getAttr('displayName') || getAttr('cn'),
              email: getAttr('mail'),
              ldap_dn: entry.objectName
            };
          });

          res.on('end', async () => {
            client.unbind();
            
            if (userInfo) {
              await this.insertLDAPAdmin(userInfo);
              resolve(true);
            } else {
              this.log(`LDAP中未找到用户: ${username}`, 'warning');
              resolve(false);
            }
          });
        });
      });
    });
  }

  async insertLDAPAdmin(userInfo) {
    try {
      const checkResult = await this.dbPool.query(
        'SELECT id FROM admins WHERE username = $1',
        [userInfo.username]
      );

      if (checkResult.rows.length > 0) {
        this.log(`管理员用户已存在: ${userInfo.username}`, 'warning');
        return;
      }

      await this.dbPool.query(`
        INSERT INTO admins (username, full_name, email, ldap_dn, role)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        userInfo.username,
        userInfo.full_name,
        userInfo.email,
        userInfo.ldap_dn,
        'admin'
      ]);

      this.log(`LDAP管理员用户创建成功: ${userInfo.username} (${userInfo.full_name})`, 'success');
    } catch (error) {
      this.log(`创建LDAP管理员失败: ${error.message}`, 'error');
    }
  }

  async createDefaultAdmin() {
    this.log('检查默认管理员账号...', 'info');
    
    try {
      const result = await this.dbPool.query(
        'SELECT id FROM admins WHERE username = $1',
        ['admin']
      );

      if (result.rows.length > 0) {
        this.log('默认管理员账号已存在', 'warning');
        return;
      }

      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);

      await this.dbPool.query(`
        INSERT INTO admins (username, password_hash, full_name, email, role)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        'admin',
        passwordHash,
        '默认管理员',
        'admin@hpc.university.edu',
        'super_admin'
      ]);

      this.log(`默认管理员创建成功: admin / ${defaultPassword}`, 'success');
      this.log('⚠️  生产环境请务必修改默认密码！', 'warning');
    } catch (error) {
      this.log(`创建默认管理员失败: ${error.message}`, 'error');
    }
  }

  async printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 系统初始化完成');
    console.log('='.repeat(60));
    
    if (this.errors.length > 0) {
      console.log('\n❌ 错误列表:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  警告列表:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log('\n📋 后续操作:');
    console.log('  1. 检查上述错误和警告');
    console.log('  2. 启动后端服务: npm run dev');
    console.log('  3. 启动前端服务: npm start');
    console.log('  4. 访问系统: http://your-server:3000');
    
    if (this.errors.length === 0) {
      console.log('\n✅ 系统已准备就绪！');
      return true;
    } else {
      console.log('\n❌ 系统初始化失败，请修复错误后重试。');
      return false;
    }
  }

  async run() {
    console.log('🚀 开始初始化HPC用户管理系统...\n');
    
    await this.checkEnvironmentVariables();
    
    const dbConnected = await this.checkDatabaseConnection();
    if (dbConnected) {
      await this.checkAndCreateTables();
      await this.createLDAPAdmins();
      await this.createDefaultAdmin();
    }
    
    await this.checkLDAPConnection();
    await this.checkLDAPStructure();
    
    const success = await this.printSummary();
    
    if (this.dbPool) {
      await this.dbPool.end();
    }
    
    process.exit(success ? 0 : 1);
  }
}

// 运行初始化
if (require.main === module) {
  const initializer = new SystemInitializer();
  initializer.run().catch(error => {
    console.error('💥 初始化过程中发生未处理的错误:', error);
    process.exit(1);
  });
}

module.exports = SystemInitializer;