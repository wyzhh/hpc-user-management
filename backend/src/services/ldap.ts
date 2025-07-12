import * as ldap from 'ldapjs';
import config from '../config';
import { PIInfo, Student, CreateStudentRequest } from '../types';

export class LDAPService {
  private createClient(): ldap.Client {
    return ldap.createClient({
      url: config.ldap.url,
      timeout: 30000,
      connectTimeout: 30000,
      idleTimeout: 60000,
    });
  }

  private async bindClient(client: ldap.Client): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('开始管理员绑定LDAP...');
      const timer = setTimeout(() => {
        console.log('管理员绑定LDAP超时');
        reject(new Error('Admin LDAP bind timeout'));
      }, 30000);
      
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


  async createStudentAccount(studentData: CreateStudentRequest, piId: number): Promise<string> {
    const studentDN = `uid=${studentData.username},${config.ldap.studentOU},${config.ldap.baseDN}`;
    const client = this.createClient();
    
    try {
      console.log(`开始创建学生账号: ${studentData.username}`);
      
      // 绑定管理员
      await this.bindClient(client);

      // 获取下一个可用的UID号
      const uidNumber = await this.getNextUidNumberWithClient(client);
      
      const entry = {
        objectClass: ['inetOrgPerson', 'posixAccount'],
        uid: studentData.username,
        cn: studentData.chinese_name,
        sn: studentData.chinese_name.split('').pop() || studentData.chinese_name,
        givenName: studentData.chinese_name.split('').slice(0, -1).join('') || studentData.chinese_name,
        displayName: studentData.chinese_name,
        mail: studentData.email,
        telephoneNumber: studentData.phone || '',
        uidNumber: uidNumber.toString(),
        gidNumber: '1000',
        homeDirectory: `/home/${studentData.username}`,
        loginShell: '/bin/bash',
        userPassword: this.generateRandomPassword(),
        description: `Created by PI ID: ${piId}`,
      };

      await new Promise<void>((resolve, reject) => {
        console.log(`正在添加LDAP用户: ${studentDN}`);
        const timer = setTimeout(() => {
          reject(new Error('LDAP add user timeout'));
        }, 15000);
        
        client.add(studentDN, entry, (err) => {
          clearTimeout(timer);
          if (err) {
            console.error('LDAP添加用户失败:', err);
            reject(err);
          } else {
            console.log(`LDAP用户创建成功: ${studentDN}`);
            resolve();
          }
        });
      });

      return studentDN;
    } catch (error) {
      console.error('创建学生账号失败:', error);
      throw error;
    } finally {
      // 确保客户端被关闭
      try {
        client.unbind();
      } catch (e) {
        console.error('关闭LDAP客户端失败:', e);
      }
    }
  }

  async deleteStudentAccount(username: string): Promise<boolean> {
    const studentDN = `uid=${username},${config.ldap.studentOU},${config.ldap.baseDN}`;
    const client = this.createClient();
    
    try {
      await this.bindClient(client);

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('LDAP delete user timeout'));
        }, 15000);
        
        client.del(studentDN, (err) => {
          clearTimeout(timer);
          if (err) {
            console.error('LDAP删除用户失败:', err);
            reject(err);
          } else {
            console.log(`LDAP用户删除成功: ${studentDN}`);
            resolve();
          }
        });
      });

      return true;
    } catch (error) {
      console.error('删除学生账号失败:', error);
      return false;
    } finally {
      try {
        client.unbind();
      } catch (e) {
        console.error('关闭LDAP客户端失败:', e);
      }
    }
  }

  async checkUserExists(username: string, isPI: boolean = false): Promise<boolean> {
    const client = this.createClient();
    
    try {
      await this.bindClient(client);
      
      const searchBase = isPI 
        ? `${config.ldap.piOU},${config.ldap.baseDN}`
        : `${config.ldap.studentOU},${config.ldap.baseDN}`;
      
      const exists = await new Promise<boolean>((resolve, reject) => {
        const searchOptions = {
          scope: 'sub' as const,
          filter: `(uid=${username})`,
          attributes: ['uid'],
        };

        const timer = setTimeout(() => {
          reject(new Error('LDAP search timeout'));
        }, 15000);

        client.search(searchBase, searchOptions, (err, res) => {
          if (err) {
            clearTimeout(timer);
            reject(err);
            return;
          }

          let found = false;

          res.on('searchEntry', () => {
            found = true;
          });

          res.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });

          res.on('end', (result) => {
            clearTimeout(timer);
            if (result?.status === 0) {
              resolve(found);
            } else {
              reject(new Error(`LDAP搜索失败，状态码: ${result?.status}`));
            }
          });
        });
      });

      return exists;
    } catch (error) {
      console.error('检查用户存在性失败:', error);
      return false;
    } finally {
      try {
        client.unbind();
      } catch (e) {
        console.error('关闭LDAP客户端失败:', e);
      }
    }
  }

  // 获取所有PI用户
  async getAllPIUsers(): Promise<PIInfo[]> {
    const client = this.createClient();
    
    try {
      await this.bindClient(client);
      
      const searchBase = `${config.ldap.piOU},${config.ldap.baseDN}`;
      
      const piUsers = await new Promise<PIInfo[]>((resolve, reject) => {
        const searchOptions = {
          scope: 'sub' as const,
          filter: '(objectClass=person)',
          attributes: [
            config.ldap.attributes.pi.username,
            config.ldap.attributes.pi.name,
            config.ldap.attributes.pi.email,
            config.ldap.attributes.pi.phone,
            config.ldap.attributes.pi.department,
            config.ldap.attributes.pi.cn,
            'dn'
          ],
        };

        const timer = setTimeout(() => {
          reject(new Error('LDAP search timeout'));
        }, 30000);

        const users: PIInfo[] = [];

        client.search(searchBase, searchOptions, (err, res) => {
          if (err) {
            clearTimeout(timer);
            reject(err);
            return;
          }

          res.on('searchEntry', (entry) => {
            try {
              const attrs = entry.attributes;
              const getAttrValue = (name: string) => {
                const attr = attrs.find(a => a.type === name);
                return attr && attr.values.length > 0 ? attr.values[0] : '';
              };

              const piUser: PIInfo = {
                id: 0, // 临时ID，数据库中会自动分配
                ldap_dn: entry.dn,
                username: getAttrValue(config.ldap.attributes.pi.username),
                full_name: getAttrValue(config.ldap.attributes.pi.name),
                email: getAttrValue(config.ldap.attributes.pi.email),
                department: getAttrValue(config.ldap.attributes.pi.department) || undefined,
                phone: getAttrValue(config.ldap.attributes.pi.phone) || undefined,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              };

              if (piUser.username) {
                users.push(piUser);
              }
            } catch (error) {
              console.error('解析PI用户条目失败:', error);
            }
          });

          res.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });

          res.on('end', (result) => {
            clearTimeout(timer);
            if (result?.status === 0) {
              console.log(`从LDAP获取到 ${users.length} 个PI用户`);
              resolve(users);
            } else {
              reject(new Error(`LDAP搜索失败，状态码: ${result?.status}`));
            }
          });
        });
      });

      return piUsers;
    } catch (error) {
      console.error('获取所有PI用户失败:', error);
      throw error;
    } finally {
      try {
        await this.unbindClient(client);
      } catch (e) {
        console.error('关闭LDAP客户端失败:', e);
      }
    }
  }

  // 获取所有学生用户
  async getAllStudentUsers(): Promise<Student[]> {
    const client = this.createClient();
    
    try {
      await this.bindClient(client);
      
      const searchBase = `${config.ldap.studentOU},${config.ldap.baseDN}`;
      
      const studentUsers = await new Promise<Student[]>((resolve, reject) => {
        const searchOptions = {
          scope: 'sub' as const,
          filter: '(objectClass=person)',
          attributes: [
            config.ldap.attributes.student.username,
            config.ldap.attributes.student.name,
            config.ldap.attributes.student.email,
            config.ldap.attributes.student.phone,
            'dn'
          ],
        };

        const timer = setTimeout(() => {
          reject(new Error('LDAP search timeout'));
        }, 30000);

        const users: Student[] = [];

        client.search(searchBase, searchOptions, (err, res) => {
          if (err) {
            clearTimeout(timer);
            reject(err);
            return;
          }

          res.on('searchEntry', (entry) => {
            try {
              const attrs = entry.attributes;
              const getAttrValue = (name: string) => {
                const attr = attrs.find(a => a.type === name);
                return attr && attr.values.length > 0 ? attr.values[0] : '';
              };

              const studentUser: Student = {
                id: 0, // 临时ID，数据库中会自动分配
                username: getAttrValue(config.ldap.attributes.student.username),
                chinese_name: getAttrValue(config.ldap.attributes.student.name),
                email: getAttrValue(config.ldap.attributes.student.email),
                phone: getAttrValue(config.ldap.attributes.student.phone) || undefined,
                pi_id: 0, // 需要后续匹配
                ldap_dn: entry.dn,
                status: 'active' as const,
                created_at: new Date(),
                updated_at: new Date(),
              };

              if (studentUser.username) {
                users.push(studentUser);
              }
            } catch (error) {
              console.error('解析学生用户条目失败:', error);
            }
          });

          res.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });

          res.on('end', (result) => {
            clearTimeout(timer);
            if (result?.status === 0) {
              console.log(`从LDAP获取到 ${users.length} 个学生用户`);
              resolve(users);
            } else {
              reject(new Error(`LDAP搜索失败，状态码: ${result?.status}`));
            }
          });
        });
      });

      return studentUsers;
    } catch (error) {
      console.error('获取所有学生用户失败:', error);
      throw error;
    } finally {
      try {
        await this.unbindClient(client);
      } catch (e) {
        console.error('关闭LDAP客户端失败:', e);
      }
    }
  }

  // 根据学生的DN信息推断其PI
  async getStudentPIMapping(studentDN: string): Promise<string | null> {
    // 这里可以实现根据LDAP组织结构或属性来确定学生的PI
    // 示例实现：从DN中提取PI信息，或通过LDAP组查询
    try {
      // 简化实现：如果学生DN包含PI信息，可以从中提取
      // 实际实现需要根据你的LDAP结构来调整
      const match = studentDN.match(/ou=([^,]+)/i);
      return match ? match[1] : null;
    } catch (error) {
      console.error('获取学生PI映射失败:', error);
      return null;
    }
  }


  private async getNextUidNumberWithClient(client: ldap.Client): Promise<number> {
    try {
      const searchOptions = {
        scope: 'sub' as const,
        filter: '(objectClass=posixAccount)',
        attributes: ['uidNumber'],
      };

      const maxUid = await new Promise<number>((resolve, reject) => {
        let maxUidNumber = 20000; // 学生UID从20000开始
        
        const timer = setTimeout(() => {
          reject(new Error('Get UID number timeout'));
        }, 10000);

        client.search(config.ldap.baseDN, searchOptions, (err, res) => {
          if (err) {
            clearTimeout(timer);
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
            clearTimeout(timer);
            reject(err);
          });

          res.on('end', (result) => {
            clearTimeout(timer);
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
    const client = this.createClient();
    try {
      await this.bindClient(client);
      console.log('✅ LDAP连接测试成功');
      return true;
    } catch (error) {
      console.error('❌ LDAP连接测试失败:', error);
      return false;
    } finally {
      try {
        client.unbind();
      } catch (e) {
        console.error('关闭LDAP客户端失败:', e);
      }
    }
  }
}

// 创建单例实例
export const ldapService = new LDAPService();