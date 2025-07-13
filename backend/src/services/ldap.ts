import * as ldap from 'ldapjs';
import config from '../config';
import { PIInfo, Student, CreateStudentRequest, LDAPUser } from '../types';

export class LDAPService {
  private createClient(): ldap.Client {
    return ldap.createClient({
      url: config.ldap.url,
      timeout: config.ldap.timeout,
      connectTimeout: config.ldap.connectTimeout,
      idleTimeout: config.ldap.idleTimeout,
    });
  }

  private async bindClient(client: ldap.Client): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('开始管理员绑定LDAP...');
      const timer = setTimeout(() => {
        console.log('管理员绑定LDAP超时');
        reject(new Error('Admin LDAP bind timeout'));
      }, config.ldap.connectTimeout);
      
      client.bind(config.ldap.bindDN, config.ldap.bindCredentials, (err) => {
        clearTimeout(timer);
        if (err) {
          console.error('LDAP管理员绑定失败:', err);
          reject(err);
        } else {
          console.log('LDAP管理员绑定成功');
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

  // 新增：获取所有用户（包含POSIX属性）
  async getAllUsersWithPosix(): Promise<LDAPUser[]> {
    const client = this.createClient();
    
    try {
      await this.bindClient(client);
      
      const users: LDAPUser[] = [];
      
      // 从新的 ou=users 获取所有用户
      try {
        const allUsers = await this.searchUsers(client, `ou=users,${config.ldap.baseDN}`);
        users.push(...allUsers);
        console.log(`从 ou=users 获取到 ${allUsers.length} 个用户`);
      } catch (error) {
        console.log('ou=users 不存在或为空，尝试从传统OU获取用户');
        
        // 兼容：从传统的PI和学生OU获取用户
        try {
          const piUsers = await this.searchUsers(client, `${config.ldap.piOU},${config.ldap.baseDN}`);
          users.push(...piUsers);
          console.log(`从 ${config.ldap.piOU} 获取到 ${piUsers.length} 个用户`);
        } catch (piError) {
          console.log('获取PI用户失败:', piError);
        }
        
        try {
          const studentUsers = await this.searchUsers(client, `${config.ldap.studentOU},${config.ldap.baseDN}`);
          users.push(...studentUsers);
          console.log(`从 ${config.ldap.studentOU} 获取到 ${studentUsers.length} 个用户`);
        } catch (studentError) {
          console.log('获取学生用户失败:', studentError);
        }
      }
      
      console.log(`从LDAP总共获取到 ${users.length} 个用户 (包含POSIX属性)`);
      return users;
      
    } catch (error) {
      console.error('获取LDAP用户失败:', error);
      throw error;
    } finally {
      await this.unbindClient(client);
    }
  }

  // 搜索用户的通用方法
  private async searchUsers(client: ldap.Client, searchBase: string): Promise<LDAPUser[]> {
    return new Promise((resolve, reject) => {
      const users: LDAPUser[] = [];
      
      const opts = {
        filter: '(&(objectClass=person)(objectClass=posixAccount))', // 确保有POSIX属性
        scope: 'sub' as const,
        attributes: [
          'uid', 'uidNumber', 'gidNumber', 'cn', 'displayName', 
          'mail', 'telephoneNumber', 'homeDirectory', 'loginShell', 'ou'
        ]
      };

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

          // 确保必要的POSIX属性存在
          if (attrs.uid && attrs.uidNumber && attrs.gidNumber) {
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
          } else {
            console.warn(`用户 ${attrs.uid || 'unknown'} 缺少POSIX属性，跳过`);
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
    const client = this.createClient();
    
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
        client.search(config.ldap.baseDN, opts, (err, res) => {
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
    const client = this.createClient();
    
    try {
      await this.bindClient(client);
      
      const opts = {
        filter: `(&(objectClass=posixAccount)(uid=${username}))`,
        scope: 'sub' as const,
        attributes: [
          'uid', 'uidNumber', 'gidNumber', 'cn', 'displayName', 
          'mail', 'telephoneNumber', 'homeDirectory', 'loginShell', 'ou'
        ]
      };

      return new Promise((resolve, reject) => {
        client.search(config.ldap.baseDN, opts, (err, res) => {
          if (err) {
            reject(err);
            return;
          }

          let user: LDAPUser | null = null;

          res.on('searchEntry', (entry) => {
            const attrs = entry.attributes.reduce((acc, attr) => {
              acc[attr.type] = Array.isArray(attr.vals) && attr.vals.length === 1 
                ? attr.vals[0] 
                : attr.vals;
              return acc;
            }, {} as any);

            user = {
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

  // 兼容方法：保持现有API工作
  async authenticatePI(username: string, password: string): Promise<PIInfo | null> {
    // 尝试多个可能的DN位置
    const possibleDNs = [
      `uid=${username},ou=users,${config.ldap.baseDN}`,  // 新的中性用户位置
      `uid=${username},${config.ldap.piOU},${config.ldap.baseDN}`,  // 传统PI位置
    ];
    
    try {
      const client = this.createClient();
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
          console.log(`LDAP认证成功，使用DN: ${dn}`);
          break;
        } catch (err) {
          console.log(`LDAP认证失败，DN: ${dn}, 错误: ${err}`);
          continue;
        }
      }
      
      if (!authenticatedDN) {
        console.log(`所有DN尝试失败，用户: ${username}`);
        await this.unbindClient(client);
        return null;
      }

      // 认证成功，获取用户信息
      const ldapUser = await this.getUserByUsername(username);
      if (ldapUser) {
        return {
          id: 0, // 临时ID，实际应该从数据库获取
          user_id: 0,
          ldap_dn: ldapUser.dn,
          username: ldapUser.uid,
          full_name: ldapUser.displayName || ldapUser.cn,
          email: ldapUser.mail,
          phone: ldapUser.telephoneNumber,
          department: ldapUser.ou,
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
      console.error('PI认证失败:', error);
      return null;
    }
  }

  // 兼容方法：学生认证
  async authenticateStudent(username: string, password: string): Promise<Student | null> {
    const studentDN = `uid=${username},${config.ldap.studentOU},${config.ldap.baseDN}`;
    
    try {
      const client = this.createClient();
      
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
          chinese_name: ldapUser.displayName || ldapUser.cn,
          email: ldapUser.mail,
          phone: ldapUser.telephoneNumber,
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
    const client = this.createClient();
    
    try {
      await this.bindClient(client);
      console.log('✅ LDAP连接测试成功');
      return true;
    } catch (error) {
      console.error('❌ LDAP连接测试失败:', error);
      return false;
    } finally {
      await this.unbindClient(client);
    }
  }

  // 兼容方法：获取所有PI用户
  async getAllPIUsers(): Promise<PIInfo[]> {
    try {
      const allUsers = await this.getAllUsersWithPosix();
      const piUsers = allUsers.filter(user => 
        user.dn.includes(config.ldap.piOU)
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
      const allUsers = await this.getAllUsersWithPosix();
      const studentUsers = allUsers.filter(user => 
        user.dn.includes(config.ldap.studentOU)
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
    const client = this.createClient();
    
    try {
      await this.bindClient(client);
      
      const searchFilter = `(|(uid=*${searchTerm}*)(cn=*${searchTerm}*)(displayName=*${searchTerm}*)(mail=*${searchTerm}*))`;
      
      return await this.searchUsers(client, `ou=users,${config.ldap.baseDN}`, searchFilter);
    } catch (error) {
      console.error('搜索用户失败:', error);
      // 如果ou=users不存在，尝试在整个基础DN中搜索
      try {
        const searchFilter = `(|(uid=*${searchTerm}*)(cn=*${searchTerm}*)(displayName=*${searchTerm}*)(mail=*${searchTerm}*))`;
        return await this.searchUsers(client, config.ldap.baseDN, searchFilter);
      } catch (fallbackError) {
        console.error('回退搜索也失败:', fallbackError);
        return [];
      }
    } finally {
      await this.unbindClient(client);
    }
  }

  // 根据用户名获取用户（用于管理员设置）
  async getUserByUsername(username: string): Promise<any | null> {
    const client = this.createClient();
    
    try {
      await this.bindClient(client);
      
      const searchFilter = `(uid=${username})`;
      let users: any[] = [];
      
      // 首先尝试在ou=users中搜索
      try {
        users = await this.searchUsers(client, `ou=users,${config.ldap.baseDN}`, searchFilter);
      } catch (error) {
        console.log('在ou=users中搜索失败，尝试在整个基础DN中搜索');
        // 如果失败，在整个基础DN中搜索
        users = await this.searchUsers(client, config.ldap.baseDN, searchFilter);
      }
      
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('获取用户失败:', error);
      return null;
    } finally {
      await this.unbindClient(client);
    }
  }
}

export const ldapService = new LDAPService();