import * as ldap from 'ldapjs';
import config from '../config';
import { PIInfo, Student, CreateStudentRequest, LDAPUser } from '../types';
import { ldapConfigService, LdapConfig } from './LdapConfigService';

export class LDAPService {
  private ldapConfig: LdapConfig | null = null;

  private async ensureConfig(): Promise<LdapConfig> {
    if (!this.ldapConfig) {
      this.ldapConfig = await ldapConfigService.loadConfig();
    }
    return this.ldapConfig;
  }

  private async createClient(): Promise<ldap.Client> {
    const config = await this.ensureConfig();
    const serverConfig = config.server;
    
    return ldap.createClient({
      url: serverConfig.url,
      timeout: serverConfig.timeout,
      connectTimeout: serverConfig.connect_timeout,
      idleTimeout: serverConfig.idle_timeout,
    });
  }

  private async bindClient(client: ldap.Client): Promise<void> {
    const config = await this.ensureConfig();
    const serverConfig = config.server;
    
    return new Promise((resolve, reject) => {
      if (config.logging.enabled && config.logging.log_auth_attempts) {
        console.log('开始管理员绑定LDAP...');
      }
      
      const timer = setTimeout(() => {
        console.log('管理员绑定LDAP超时');
        reject(new Error('Admin LDAP bind timeout'));
      }, serverConfig.connect_timeout);
      
      client.bind(serverConfig.bind_dn, serverConfig.bind_password, (err) => {
        clearTimeout(timer);
        if (err) {
          console.error('LDAP管理员绑定失败:', err);
          reject(err);
        } else {
          if (config.logging.enabled && config.logging.log_auth_attempts) {
            console.log('LDAP管理员绑定成功');
          }
          resolve();
        }
      });
    });
  }

  private async unbindClient(client: ldap.Client): Promise<void> {
    return new Promise((resolve) => {
      client.unbind((err) => {
        if (err) {
          console.error('LDAP解绑失败:', err);
        }
        resolve();
      });
    });
  }

  // 获取所有用户（包含POSIX属性）
  async getAllUsersWithPosix(): Promise<LDAPUser[]> {
    const ldapConfig = await this.ensureConfig();
    const client = await this.createClient();
    
    try {
      await this.bindClient(client);
      
      const users: LDAPUser[] = [];
      const ouConfig = ldapConfig.organizational_units;
      
      // 从主要用户OU获取所有用户
      try {
        const allUsers = await this.searchUsers(client, ouConfig.users);
        users.push(...allUsers);
        if (ldapConfig.logging.enabled) {
          console.log(`从 ${ouConfig.users} 获取到 ${allUsers.length} 个用户`);
        }
      } catch (error) {
        if (ldapConfig.logging.enabled) {
          console.log('主要用户OU不存在或为空，尝试从兼容OU获取用户');
        }
        
        // 兼容：从传统的PI和学生OU获取用户
        try {
          const piUsers = await this.searchUsers(client, ouConfig.legacy.pi_ou);
          users.push(...piUsers);
          if (ldapConfig.logging.enabled) {
            console.log(`从 ${ouConfig.legacy.pi_ou} 获取到 ${piUsers.length} 个用户`);
          }
        } catch (piError) {
          if (ldapConfig.logging.enabled) {
            console.log('获取PI用户失败:', piError);
          }
        }
        
        try {
          const studentUsers = await this.searchUsers(client, ouConfig.legacy.student_ou);
          users.push(...studentUsers);
          if (ldapConfig.logging.enabled) {
            console.log(`从 ${ouConfig.legacy.student_ou} 获取到 ${studentUsers.length} 个用户`);
          }
        } catch (studentError) {
          if (ldapConfig.logging.enabled) {
            console.log('获取学生用户失败:', studentError);
          }
        }
      }
      
      if (ldapConfig.logging.enabled) {
        console.log(`从LDAP总共获取到 ${users.length} 个用户 (包含POSIX属性)`);
      }
      return users;
      
    } catch (error) {
      console.error('获取LDAP用户失败:', error);
      throw error;
    } finally {
      await this.unbindClient(client);
    }
  }

  // 搜索用户的通用方法
  private async searchUsers(client: ldap.Client, searchBase: string, customFilter?: string): Promise<LDAPUser[]> {
    const ldapConfig = await this.ensureConfig();
    
    return new Promise((resolve, reject) => {
      const users: LDAPUser[] = [];
      
      // 使用配置中的基础过滤器
      const baseFilter = ldapConfig.filters.user_base;
      const filter = customFilter 
        ? `(&${baseFilter}${customFilter})`
        : baseFilter;
      
      // 使用配置中的查询属性
      const attributes = ldapConfig.query_attributes.basic_user;
      
      const opts = {
        filter: filter,
        scope: 'sub' as const,
        attributes: attributes
      };

      if (ldapConfig.logging.enabled && ldapConfig.logging.log_queries) {
        console.log(`LDAP查询 - Base: ${searchBase}, Filter: ${filter}`);
      }

      client.search(searchBase, opts, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        res.on('searchEntry', (entry) => {
          const attrs = entry.attributes.reduce((acc, attr) => {
            acc[attr.type] = Array.isArray(attr.vals) && attr.vals.length === 1 
              ? attr.vals[0] 
              : attr.vals;
            return acc;
          }, {} as any);

          // 使用配置中的属性映射
          const attrConfig = ldapConfig.attributes.user;
          const uid = attrs[attrConfig.username];
          const uidNumber = attrs[attrConfig.user_id];
          const gidNumber = attrs[attrConfig.group_id];

          // 确保必要的POSIX属性存在
          if (uid && uidNumber && gidNumber) {
            users.push({
              dn: entry.dn.toString(),
              uid: uid,
              uidNumber: parseInt(uidNumber),
              gidNumber: parseInt(gidNumber),
              cn: null,
              displayName: null,
              mail: null,
              telephoneNumber: null,
              homeDirectory: attrs[attrConfig.home_directory],
              loginShell: null,
              ou: null
            });
          } else {
            if (ldapConfig.logging.enabled) {
              console.warn(`用户 ${uid || 'unknown'} 缺少POSIX属性，跳过`);
            }
          }
        });

        res.on('error', (err) => {
          reject(err);
        });

        res.on('end', (result) => {
          if (result?.status === 0) {
            resolve(users);
          } else {
            reject(new Error(`LDAP搜索失败: ${result?.status}`));
          }
        });
      });
    });
  }

  // 根据GID获取用户（课题组成员）
  async getUsersByGid(gid: number): Promise<LDAPUser[]> {
    const ldapConfig = await this.ensureConfig();
    const client = await this.createClient();
    
    try {
      await this.bindClient(client);
      
      const users: LDAPUser[] = [];
      
      const opts = {
        filter: `(&(objectClass=posixAccount)(gidNumber=${gid}))`,
        scope: 'sub' as const,
        attributes: [
          'uid', 'uidNumber', 'gidNumber', 'cn', 'displayName', 
          'mail', 'telephoneNumber', 'homeDirectory', 'loginShell', 'ou'
        ]
      };

      return new Promise((resolve, reject) => {
        client.search(ldapConfig.server.base_dn, opts, (err, res) => {
          if (err) {
            reject(err);
            return;
          }

          res.on('searchEntry', (entry) => {
            const attrs = entry.attributes.reduce((acc, attr) => {
              const values = attr.values || attr.vals; // 使用新的values属性，回退到vals
              acc[attr.type] = Array.isArray(values) && values.length === 1 
                ? values[0] 
                : values;
              return acc;
            }, {} as any);

            users.push({
              dn: entry.dn.toString(),
              uid: attrs.uid,
              uidNumber: parseInt(attrs.uidNumber),
              gidNumber: parseInt(attrs.gidNumber),
              cn: attrs.cn,
              displayName: attrs.displayName,
              mail: attrs.mail,
              telephoneNumber: attrs.telephoneNumber,
              homeDirectory: attrs.homeDirectory,
              loginShell: attrs.loginShell || '/bin/bash',
              ou: attrs.ou
            });
          });

          res.on('error', (err) => {
            reject(err);
          });

          res.on('end', (result) => {
            if (result?.status === 0) {
              resolve(users);
            } else {
              reject(new Error(`LDAP搜索失败: ${result?.status}`));
            }
          });
        });
      });
    } catch (error) {
      console.error(`获取GID ${gid} 的用户失败:`, error);
      throw error;
    } finally {
      await this.unbindClient(client);
    }
  }

  // 获取特定用户的详细信息
  async getUserByUsername(username: string): Promise<LDAPUser | null> {
    const ldapConfig = await this.ensureConfig();
    const client = await this.createClient();
    
    try {
      await this.bindClient(client);
      
      // 使用配置中的过滤器
      const filter = ldapConfigService.buildFilter('user_by_username', { username });
      
      // 使用配置中的详细查询属性
      const attributes = ldapConfig.query_attributes.detailed_user;
      
      const opts = {
        filter: filter,
        scope: 'sub' as const,
        attributes: attributes
      };

      return new Promise((resolve, reject) => {
        client.search(ldapConfig.server.base_dn, opts, (err, res) => {
          if (err) {
            reject(err);
            return;
          }

          let user: LDAPUser | null = null;

          res.on('searchEntry', (entry) => {
            const attrs = entry.attributes.reduce((acc, attr) => {
              const values = attr.values || attr.vals; // 使用新的values属性，回退到vals
              acc[attr.type] = Array.isArray(values) && values.length === 1 
                ? values[0] 
                : values;
              return acc;
            }, {} as any);

            // 使用配置中的属性映射
            const attrConfig = ldapConfig.attributes.user;
            user = {
              dn: entry.dn.toString(),
              uid: attrs[attrConfig.username],
              uidNumber: parseInt(attrs[attrConfig.user_id]),
              gidNumber: parseInt(attrs[attrConfig.group_id]),
              cn: null,
              displayName: null,
              mail: null,
              telephoneNumber: null,
              homeDirectory: attrs[attrConfig.home_directory],
              loginShell: null,
              ou: null
            };
          });

          res.on('error', (err) => {
            reject(err);
          });

          res.on('end', (result) => {
            if (result?.status === 0) {
              resolve(user);
            } else {
              reject(new Error(`LDAP搜索失败: ${result?.status}`));
            }
          });
        });
      });
    } catch (error) {
      console.error(`获取用户 ${username} 失败:`, error);
      throw error;
    } finally {
      await this.unbindClient(client);
    }
  }

  // 通用用户认证方法（支持PI、管理员等）
  async authenticateUser(username: string, password: string): Promise<PIInfo | null> {
    const ldapConfig = await this.ensureConfig();
    const client = await this.createClient();
    
    try {
      // 获取可能的用户DN模板
      const possibleDNs = ldapConfigService.buildUserDN(username);
      
      let authenticatedDN = null;
      
      // 尝试不同的DN进行认证
      for (const dn of possibleDNs) {
        try {
          await new Promise<void>((resolve, reject) => {
            client.bind(dn, password, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
          authenticatedDN = dn;
          
          if (ldapConfig.logging.enabled && ldapConfig.logging.log_auth_attempts) {
            console.log(`LDAP认证成功，用户: ${username}, DN: ${dn}`);
          }
          break;
        } catch (err) {
          if (ldapConfig.logging.enabled && ldapConfig.logging.log_auth_attempts) {
            console.log(`LDAP认证失败，用户: ${username}, DN: ${dn}, 错误: ${err}`);
          }
          continue;
        }
      }
      
      if (!authenticatedDN) {
        if (ldapConfig.logging.enabled && ldapConfig.logging.log_auth_attempts) {
          console.log(`所有DN尝试失败，用户: ${username}`);
        }
        await this.unbindClient(client);
        return null;
      }

      // 认证成功，获取用户详细信息
      const ldapUser = await this.getUserByUsername(username);
      if (ldapUser) {
        return {
          id: 0, // 临时ID，实际应该从数据库获取
          user_id: 0,
          ldap_dn: ldapUser.dn,
          username: ldapUser.uid,
          full_name: null, // 从数据库获取
          email: null,     // 从数据库获取
          phone: null,     // 从数据库获取
          department: null, // 从数据库获取
          office_location: '',
          research_area: '',
          max_students: 10,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };
      }
      
      await this.unbindClient(client);
      return null;
    } catch (error) {
      console.error('用户认证失败:', error);
      return null;
    }
  }

  // 兼容方法：保持现有API工作
  async authenticatePI(username: string, password: string): Promise<PIInfo | null> {
    return await this.authenticateUser(username, password);
  }

  // 兼容方法：学生认证
  async authenticateStudent(username: string, password: string): Promise<Student | null> {
    const ldapConfig = await this.ensureConfig();
    const studentDN = `uid=${username},${ldapConfig.organizational_units.legacy.student_ou},${ldapConfig.server.base_dn}`;
    
    try {
      const client = await this.createClient();
      
      await new Promise<void>((resolve, reject) => {
        client.bind(studentDN, password, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      const ldapUser = await this.getUserByUsername(username);
      if (ldapUser) {
        return {
          id: 0,
          user_id: 0,
          username: ldapUser.uid,
          chinese_name: null, // 从数据库获取
          email: null,        // 从数据库获取
          phone: null,        // 从数据库获取
          ldap_dn: ldapUser.dn,
          status: 'active',
          pi_id: undefined,
          student_id: '',
          major: '',
          enrollment_year: undefined,
          degree_level: undefined,
          join_date: undefined,
          expected_graduation: undefined,
          created_at: new Date(),
          updated_at: new Date()
        };
      }
      
      await this.unbindClient(client);
      return null;
    } catch (error) {
      console.error('学生认证失败:', error);
      return null;
    }
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    const ldapConfig = await this.ensureConfig();
    const client = await this.createClient();
    
    try {
      await this.bindClient(client);
      
      if (ldapConfig.logging.enabled) {
        console.log('✅ LDAP连接测试成功');
        console.log(`   服务器: ${ldapConfig.server.url}`);
        console.log(`   Base DN: ${ldapConfig.server.base_dn}`);
        console.log(`   用户OU: ${ldapConfig.organizational_units.users}`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ LDAP连接测试失败:', error);
      console.error(`   服务器: ${ldapConfig.server.url}`);
      console.error(`   绑定DN: ${ldapConfig.server.bind_dn}`);
      return false;
    } finally {
      await this.unbindClient(client);
    }
  }

  // 验证LDAP配置
  async validateConfiguration(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    return await ldapConfigService.validateConfigFile();
  }

  // 重新加载LDAP配置
  async reloadConfiguration(): Promise<void> {
    this.ldapConfig = null;
    await ldapConfigService.reloadConfig();
    console.log('LDAP配置已重新加载');
  }

  // 兼容方法：获取所有PI用户
  async getAllPIUsers(): Promise<PIInfo[]> {
    try {
      const ldapConfig = await this.ensureConfig();
      const allUsers = await this.getAllUsersWithPosix();
      const piUsers = allUsers.filter(user => 
        user.dn.includes(ldapConfig.organizational_units.legacy.pi_ou)
      );

      return piUsers.map(user => ({
        id: 0,
        user_id: 0,
        ldap_dn: user.dn,
        username: user.uid,
        full_name: user.displayName || user.cn,
        email: user.mail,
        phone: user.telephoneNumber,
        department: user.ou,
        office_location: '',
        research_area: '',
        max_students: 10,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }));
    } catch (error) {
      console.error('获取PI用户失败:', error);
      return [];
    }
  }

  // 兼容方法：获取所有学生用户
  async getAllStudentUsers(): Promise<Student[]> {
    try {
      const ldapConfig = await this.ensureConfig();
      const allUsers = await this.getAllUsersWithPosix();
      const studentUsers = allUsers.filter(user => 
        user.dn.includes(ldapConfig.organizational_units.legacy.student_ou)
      );

      return studentUsers.map(user => ({
        id: 0,
        user_id: 0,
        username: user.uid,
        chinese_name: user.displayName || user.cn,
        email: user.mail,
        phone: user.telephoneNumber,
        ldap_dn: user.dn,
        status: 'active',
        pi_id: undefined,
        student_id: '',
        major: '',
        enrollment_year: undefined,
        degree_level: undefined,
        join_date: undefined,
        expected_graduation: undefined,
        created_at: new Date(),
        updated_at: new Date()
      }));
    } catch (error) {
      console.error('获取学生用户失败:', error);
      return [];
    }
  }

  // 搜索LDAP用户（用于初始化管理员选择）
  async searchUsersByTerm(searchTerm: string): Promise<any[]> {
    const ldapConfig = await this.ensureConfig();
    const client = await this.createClient();
    
    try {
      await this.bindClient(client);
      
      const searchFilter = `(|(uid=*${searchTerm}*)(cn=*${searchTerm}*)(displayName=*${searchTerm}*)(mail=*${searchTerm}*))`;
      
      return await this.searchUsers(client, `ou=users,${ldapConfig.server.base_dn}`, searchFilter);
    } catch (error) {
      console.error('搜索用户失败:', error);
      // 如果ou=users不存在，尝试在整个基础DN中搜索
      try {
        const searchFilter = `(|(uid=*${searchTerm}*)(cn=*${searchTerm}*)(displayName=*${searchTerm}*)(mail=*${searchTerm}*))`;
        return await this.searchUsers(client, ldapConfig.server.base_dn, searchFilter);
      } catch (fallbackError) {
        console.error('回退搜索也失败:', fallbackError);
        return [];
      }
    } finally {
      await this.unbindClient(client);
    }
  }

  // 获取下一个可用的UID
  async getNextAvailableUID(): Promise<number> {
    const ldapConfig = await this.ensureConfig();
    const client = await this.createClient();
    
    try {
      await this.bindClient(client);
      
      // 搜索所有具有posixAccount的用户，获取最大的uidNumber
      const searchFilter = '(objectClass=posixAccount)';
      const users = await this.searchUsers(client, ldapConfig.organizational_units.users, searchFilter);
      
      let maxUID = 10000; // 起始UID，避免与系统用户冲突
      
      for (const user of users) {
        if (user.uidNumber && user.uidNumber > maxUID) {
          maxUID = user.uidNumber;
        }
      }
      
      return maxUID + 1;
    } catch (error) {
      console.error('获取下一个UID失败:', error);
      // 返回一个安全的默认值
      return 10000 + Math.floor(Math.random() * 1000);
    } finally {
      await this.unbindClient(client);
    }
  }

  // 获取PI的GID
  async getPIGID(piId: number): Promise<number> {
    // 从数据库查询PI的gid_number
    const pool = require('../config/database').default;
    
    try {
      const result = await pool.query(`
        SELECT u.gid_number 
        FROM pis p 
        JOIN users u ON p.user_id = u.id 
        WHERE p.id = $1 AND p.is_active = true
      `, [piId]);
      
      if (result.rows.length > 0 && result.rows[0].gid_number) {
        return result.rows[0].gid_number;
      }
      
      // 如果没有GID，返回默认值
      console.warn(`PI ${piId} 没有gid_number，使用默认GID`);
      return 10069; // 默认组GID
    } catch (error) {
      console.error('获取PI GID失败:', error);
      return 10069; // 默认组GID
    }
  }

  // 获取学生home目录基础路径
  async getStudentHomeBaseDirectory(piId: number): Promise<string> {
    const pool = require('../config/database').default;
    
    try {
      const result = await pool.query(`
        SELECT u.username, u.home_directory
        FROM pis p 
        JOIN users u ON p.user_id = u.id 
        WHERE p.id = $1 AND p.is_active = true
      `, [piId]);
      
      if (result.rows.length > 0) {
        const piUser = result.rows[0];
        if (piUser.home_directory) {
          // 从PI的home目录提取基础路径
          // 例如：从 /work/home/ztron 提取 /work/home
          const piHomePath = piUser.home_directory;
          const parentPath = piHomePath.substring(0, piHomePath.lastIndexOf('/'));
          return parentPath;
        }
      }
      
      // 默认基础路径
      return '/work/home';
    } catch (error) {
      console.error('获取学生home目录基础路径失败:', error);
      return '/work/home';
    }
  }

  // 创建学生账号
  async createStudentAccount(studentData: any, piId: number): Promise<string> {
    const ldapConfig = await this.ensureConfig();
    const client = await this.createClient();
    
    try {
      await this.bindClient(client);
      
      // 1. 获取下一个可用的UID
      const uidNumber = await this.getNextAvailableUID();
      
      // 2. 获取PI的GID
      const gidNumber = await this.getPIGID(piId);
      
      // 3. 构建家目录路径 - 学生目录直接在/work/home下
      const homeBaseDirectory = await this.getStudentHomeBaseDirectory(piId);
      const homeDirectory = `${homeBaseDirectory}/${studentData.username}`;
      
      // 4. 构建用户DN
      const userDN = `uid=${studentData.username},${ldapConfig.organizational_units.users}`;
      
      // 5. 准备用户条目
      const userEntry = {
        objectClass: ['top', 'account', 'posixAccount', 'shadowAccount'],
        uid: studentData.username,
        cn: studentData.username,
        uidNumber: uidNumber.toString(),
        gidNumber: gidNumber.toString(),
        homeDirectory: homeDirectory,
        loginShell: '/bin/bash',
        userPassword: studentData.password // 密码会被LDAP服务器加密
      };
      
      if (ldapConfig.logging.enabled) {
        console.log('创建LDAP用户:', {
          dn: userDN,
          uid: studentData.username,
          uidNumber,
          gidNumber,
          homeDirectory
        });
      }
      
      // 6. 在LDAP中创建用户
      await new Promise<void>((resolve, reject) => {
        client.add(userDN, userEntry, (err) => {
          if (err) {
            reject(new Error(`创建LDAP用户失败: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
      
      console.log(`学生账号 ${studentData.username} 已成功创建在LDAP中`);
      return userDN;
      
    } catch (error) {
      console.error('创建学生账号失败:', error);
      throw error;
    } finally {
      await this.unbindClient(client);
    }
  }

  // 删除学生账号
  async deleteStudentAccount(username: string): Promise<boolean> {
    const ldapConfig = await this.ensureConfig();
    const client = await this.createClient();
    
    try {
      await this.bindClient(client);
      
      // 构建用户DN
      const userDN = `uid=${username},${ldapConfig.organizational_units.users}`;
      
      // 从LDAP中删除用户
      await new Promise<void>((resolve, reject) => {
        client.del(userDN, (err) => {
          if (err) {
            reject(new Error(`删除LDAP用户失败: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
      
      console.log(`学生账号 ${username} 已从LDAP删除`);
      return true;
      
    } catch (error) {
      console.error('删除学生账号失败:', error);
      return false;
    } finally {
      await this.unbindClient(client);
    }
  }

  // 删除用户（通用方法）
  async deleteUser(ldapDn: string): Promise<void> {
    const client = await this.createClient();
    
    try {
      await this.bindClient(client);
      
      // 执行删除操作
      await new Promise<void>((resolve, reject) => {
        client.del(ldapDn, (err) => {
          if (err) {
            reject(new Error(`删除LDAP用户失败: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
      
      console.log(`用户 ${ldapDn} 已从LDAP删除`);
    } catch (error) {
      console.error('删除LDAP用户失败:', error);
      throw error;
    } finally {
      await this.unbindClient(client);
    }
  }

}

export const ldapService = new LDAPService();