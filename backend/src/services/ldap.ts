import * as ldap from 'ldapjs';
import config from '../config';
import { PIInfo, Student, CreateStudentRequest } from '../types';

export class LDAPService {
  private client: ldap.Client;

  constructor() {
    this.client = ldap.createClient({
      url: config.ldap.url,
      timeout: 30000,
      connectTimeout: 30000,
      idleTimeout: 60000,
    });

    this.client.on('error', (err) => {
      console.error('LDAP连接错误:', err);
    });
  }

  private async bind(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('开始管理员绑定LDAP...');
      const timer = setTimeout(() => {
        console.log('管理员绑定LDAP超时');
        reject(new Error('Admin LDAP bind timeout'));
      }, 10000);
      
      this.client.bind(config.ldap.bindDN, config.ldap.bindCredentials, (err) => {
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

  private async unbind(): Promise<void> {
    return new Promise((resolve) => {
      this.client.unbind((err) => {
        if (err) {
          console.error('LDAP解绑失败:', err);
        }
        resolve();
      });
    });
  }

  async authenticatePI(username: string, password: string): Promise<PIInfo | null> {
    const piDN = `uid=${username},${config.ldap.piOU},${config.ldap.baseDN}`;
    
    try {
      console.log(`开始PI认证: ${username}, DN: ${piDN}`);
      console.log(`LDAP URL: ${config.ldap.url}`);
      
      // 创建临时客户端用于认证
      const authClient = ldap.createClient({
        url: config.ldap.url,
        timeout: 30000,
        connectTimeout: 30000,
      });

      console.log(`创建LDAP客户端完成`);

      // 尝试绑定用户
      await new Promise<void>((resolve, reject) => {
        console.log(`开始绑定用户: ${piDN}`);
        const timer = setTimeout(() => {
          console.log(`绑定超时: ${piDN}`);
          reject(new Error('LDAP bind timeout'));
        }, 15000);
        
        authClient.bind(piDN, password, (err) => {
          clearTimeout(timer);
          if (err) {
            console.log(`绑定失败: ${err.message}`);
            reject(err);
          } else {
            console.log(`绑定成功: ${piDN}`);
            resolve();
          }
        });
      });

      console.log(`开始获取用户信息`);
      
      // 认证成功，创建新的客户端获取用户信息
      const searchClient = ldap.createClient({
        url: config.ldap.url,
        timeout: 30000,
        connectTimeout: 30000,
      });

      try {
        // 使用管理员权限绑定新客户端
        await new Promise<void>((resolve, reject) => {
          console.log('开始管理员绑定新LDAP客户端...');
          const timer = setTimeout(() => {
            console.log('管理员绑定新LDAP客户端超时');
            reject(new Error('Admin LDAP bind timeout'));
          }, 10000);
          
          searchClient.bind(config.ldap.bindDN, config.ldap.bindCredentials, (err) => {
            clearTimeout(timer);
            if (err) {
              console.error('新LDAP客户端管理员绑定失败:', err);
              reject(err);
            } else {
              console.log('新LDAP客户端管理员绑定成功');
              resolve();
            }
          });
        });

        // 搜索用户信息
        const piInfo = await this.searchPIWithClient(searchClient, username);
        
        // 关闭搜索客户端
        searchClient.unbind();
        
        // 关闭认证客户端
        authClient.unbind();

        console.log(`PI认证完成: ${username}`);
        return piInfo;
      } catch (searchError) {
        // 关闭所有客户端
        searchClient.unbind();
        authClient.unbind();
        throw searchError;
      }
    } catch (error) {
      console.error('PI认证失败:', error);
      return null;
    }
  }

  private async searchPI(username: string): Promise<PIInfo | null> {
    return new Promise((resolve, reject) => {
      const searchBase = `${config.ldap.piOU},${config.ldap.baseDN}`;
      const searchFilter = `(uid=${username})`;
      
      console.log(`开始搜索PI用户: ${username}`);
      console.log(`搜索基础DN: ${searchBase}`);
      console.log(`搜索过滤器: ${searchFilter}`);
      
      const searchOptions = {
        scope: 'sub' as const,
        filter: searchFilter,
        attributes: ['uid', 'cn', 'sn', 'givenName', 'mail', 'telephoneNumber', 'ou', 'displayName'],
      };

      const timer = setTimeout(() => {
        console.log(`搜索PI用户超时: ${username}`);
        reject(new Error('Search PI timeout'));
      }, 10000);

      this.client.search(searchBase, searchOptions, (err, res) => {
        if (err) {
          clearTimeout(timer);
          console.log(`搜索PI用户失败: ${err.message}`);
          reject(err);
          return;
        }

        console.log(`开始处理搜索结果...`);
        let piInfo: PIInfo | null = null;

        res.on('searchEntry', (entry) => {
          console.log(`找到PI用户条目: ${entry.objectName}`);
          const attrs = entry.attributes;
          const getAttr = (name: string) => {
            const attr = attrs.find(a => a.type === name);
            return attr ? attr.values[0] : '';
          };

          piInfo = {
            id: 0, // 将在数据库中设置
            ldap_dn: entry.objectName || '',
            username: getAttr('uid'),
            full_name: getAttr('displayName') || getAttr('cn'),
            email: getAttr('mail'),
            department: getAttr('ou'),
            phone: getAttr('telephoneNumber'),
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          };
          console.log(`PI用户信息解析完成: ${piInfo.username}`);
        });

        res.on('searchReference', (referral) => {
          console.log('LDAP搜索引用:', referral.uris);
        });

        res.on('error', (err) => {
          console.error('LDAP搜索错误:', err);
          reject(err);
        });

        res.on('end', (result) => {
          clearTimeout(timer);
          console.log(`LDAP搜索完成，状态码: ${result?.status}`);
          if (result?.status === 0) {
            console.log(`返回PI用户信息: ${piInfo?.username || 'null'}`);
            resolve(piInfo);
          } else {
            console.log(`LDAP搜索失败，状态码: ${result?.status}`);
            reject(new Error(`LDAP搜索失败，状态码: ${result?.status}`));
          }
        });
      });
    });
  }

  async createStudentAccount(studentData: CreateStudentRequest, piId: number): Promise<string> {
    const studentDN = `uid=${studentData.username},${config.ldap.studentOU},${config.ldap.baseDN}`;
    
    try {
      await this.bind();

      // 获取下一个可用的UID号
      const uidNumber = await this.getNextUidNumber();
      
      const entry = {
        objectClass: ['inetOrgPerson', 'posixAccount'],
        uid: studentData.username,
        cn: studentData.chinese_name,
        sn: studentData.chinese_name.split('').pop() || studentData.chinese_name, // 取最后一个字符作为姓
        givenName: studentData.chinese_name.split('').slice(0, -1).join('') || studentData.chinese_name, // 剩余字符作为名
        displayName: studentData.chinese_name,
        mail: studentData.email,
        telephoneNumber: studentData.phone || '',
        uidNumber: uidNumber.toString(),
        gidNumber: '1000', // 学生组
        homeDirectory: `/home/${studentData.username}`,
        loginShell: '/bin/bash',
        userPassword: this.generateRandomPassword(),
        description: `Created by PI ID: ${piId}`,
      };

      await new Promise<void>((resolve, reject) => {
        this.client.add(studentDN, entry, (err) => {
          if (err) {
            console.error('LDAP添加用户失败:', err);
            reject(err);
          } else {
            console.log(`LDAP用户创建成功: ${studentDN}`);
            resolve();
          }
        });
      });

      await this.unbind();
      return studentDN;
    } catch (error) {
      console.error('创建学生账号失败:', error);
      throw error;
    }
  }

  async deleteStudentAccount(username: string): Promise<boolean> {
    const studentDN = `uid=${username},${config.ldap.studentOU},${config.ldap.baseDN}`;
    
    try {
      await this.bind();

      await new Promise<void>((resolve, reject) => {
        this.client.del(studentDN, (err) => {
          if (err) {
            console.error('LDAP删除用户失败:', err);
            reject(err);
          } else {
            console.log(`LDAP用户删除成功: ${studentDN}`);
            resolve();
          }
        });
      });

      await this.unbind();
      return true;
    } catch (error) {
      console.error('删除学生账号失败:', error);
      return false;
    }
  }

  async checkUserExists(username: string, isPI: boolean = false): Promise<boolean> {
    try {
      await this.bind();
      
      const searchBase = isPI 
        ? `${config.ldap.piOU},${config.ldap.baseDN}`
        : `${config.ldap.studentOU},${config.ldap.baseDN}`;
      
      const exists = await new Promise<boolean>((resolve, reject) => {
        const searchOptions = {
          scope: 'sub' as const,
          filter: `(uid=${username})`,
          attributes: ['uid'],
        };

        this.client.search(searchBase, searchOptions, (err, res) => {
          if (err) {
            reject(err);
            return;
          }

          let found = false;

          res.on('searchEntry', () => {
            found = true;
          });

          res.on('error', (err) => {
            reject(err);
          });

          res.on('end', (result) => {
            if (result?.status === 0) {
              resolve(found);
            } else {
              reject(new Error(`LDAP搜索失败，状态码: ${result?.status}`));
            }
          });
        });
      });

      await this.unbind();
      return exists;
    } catch (error) {
      console.error('检查用户存在性失败:', error);
      return false;
    }
  }

  private async getNextUidNumber(): Promise<number> {
    try {
      const searchOptions = {
        scope: 'sub' as const,
        filter: '(objectClass=posixAccount)',
        attributes: ['uidNumber'],
      };

      const maxUid = await new Promise<number>((resolve, reject) => {
        let maxUidNumber = 20000; // 学生UID从20000开始

        this.client.search(config.ldap.baseDN, searchOptions, (err, res) => {
          if (err) {
            reject(err);
            return;
          }

          res.on('searchEntry', (entry) => {
            const uidAttr = entry.attributes.find(attr => attr.type === 'uidNumber');
            if (uidAttr && uidAttr.values.length > 0) {
              const uidNumber = parseInt(uidAttr.values[0], 10);
              if (uidNumber > maxUidNumber) {
                maxUidNumber = uidNumber;
              }
            }
          });

          res.on('error', (err) => {
            reject(err);
          });

          res.on('end', (result) => {
            if (result?.status === 0) {
              resolve(maxUidNumber);
            } else {
              reject(new Error(`LDAP搜索失败，状态码: ${result?.status}`));
            }
          });
        });
      });

      return maxUid + 1;
    } catch (error) {
      console.error('获取下一个UID号失败:', error);
      // 如果获取失败，返回一个默认值
      return 20000 + Math.floor(Math.random() * 1000);
    }
  }

  private generateRandomPassword(): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  private async searchPIWithClient(client: ldap.Client, username: string): Promise<PIInfo | null> {
    return new Promise((resolve, reject) => {
      const searchBase = `${config.ldap.piOU},${config.ldap.baseDN}`;
      const searchFilter = `(uid=${username})`;
      
      console.log(`使用新客户端搜索PI用户: ${username}`);
      
      const searchOptions = {
        scope: 'sub' as const,
        filter: searchFilter,
        attributes: ['uid', 'cn', 'sn', 'givenName', 'mail', 'telephoneNumber', 'ou', 'displayName'],
      };

      const timer = setTimeout(() => {
        console.log(`新客户端搜索PI用户超时: ${username}`);
        reject(new Error('Search PI timeout'));
      }, 10000);

      client.search(searchBase, searchOptions, (err, res) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
          return;
        }

        let piInfo: PIInfo | null = null;

        res.on('searchEntry', (entry) => {
          const attrs = entry.attributes;
          const getAttr = (name: string) => {
            const attr = attrs.find(a => a.type === name);
            return attr ? attr.values[0] : '';
          };

          piInfo = {
            id: 0,
            ldap_dn: entry.objectName || '',
            username: getAttr('uid'),
            full_name: getAttr('displayName') || getAttr('cn'),
            email: getAttr('mail'),
            department: getAttr('ou'),
            phone: getAttr('telephoneNumber'),
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          };
        });

        res.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });

        res.on('end', (result) => {
          clearTimeout(timer);
          if (result?.status === 0) {
            resolve(piInfo);
          } else {
            reject(new Error(`LDAP搜索失败，状态码: ${result?.status}`));
          }
        });
      });
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.bind();
      console.log('✅ LDAP连接测试成功');
      await this.unbind();
      return true;
    } catch (error) {
      console.error('❌ LDAP连接测试失败:', error);
      return false;
    }
  }

  destroy(): void {
    this.client.destroy();
  }
}

// 创建单例实例
export const ldapService = new LDAPService();