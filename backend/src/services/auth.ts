import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config';
import { JWTPayload, PIInfo, Admin } from '../types';
import { PIModel, AdminModel } from '../models';
import { ldapService } from './ldap';

export class AuthService {
  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const options: any = {
      expiresIn: config.jwt.expiresIn,
      issuer: config.jwt.issuer,
    };
    return jwt.sign(payload, config.jwt.secret, options);
  }

  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      console.error('JWT验证失败:', error);
      return null;
    }
  }

  static async authenticatePI(username: string, password: string): Promise<{ pi: PIInfo; token: string } | null> {
    try {
      // 1. 通过LDAP验证PI身份
      const ldapPIInfo = await ldapService.authenticatePI(username, password);
      if (!ldapPIInfo) {
        console.log(`PI LDAP认证失败: ${username}`);
        return null;
      }

      // 2. 在数据库中查找或创建PI记录
      let pi = await PIModel.findByUsername(username);
      
      if (!pi) {
        // 如果数据库中不存在，则创建新记录
        pi = await PIModel.create({
          ldap_dn: ldapPIInfo.ldap_dn,
          username: ldapPIInfo.username,
          full_name: ldapPIInfo.full_name,
          email: ldapPIInfo.email,
          department: ldapPIInfo.department,
          phone: ldapPIInfo.phone,
          is_active: true,
        });
        console.log(`新PI用户已创建: ${username}`);
      } else {
        // 更新PI信息（可能在LDAP中有变化）
        await PIModel.update(pi.id, {
          full_name: ldapPIInfo.full_name,
          email: ldapPIInfo.email,
          department: ldapPIInfo.department,
          phone: ldapPIInfo.phone,
        });
        console.log(`PI用户信息已更新: ${username}`);
      }

      // 3. 生成JWT token
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        id: pi.id,
        username: pi.username,
        role: 'pi',
      };

      const token = this.generateToken(tokenPayload);

      return { pi, token };
    } catch (error) {
      console.error('PI认证过程出错:', error);
      return null;
    }
  }

  static async authenticateAdmin(username: string, password: string): Promise<{ admin: Admin; token: string } | null> {
    try {
      // 从数据库查找管理员
      const admin = await AdminModel.findByUsername(username);
      
      if (admin) {
        // 数据库管理员认证
        if (admin.password_hash) {
          // 使用密码哈希验证
          const isPasswordValid = bcrypt.compareSync(password, admin.password_hash);
          if (!isPasswordValid) {
            console.log(`管理员密码错误: ${username}`);
            return null;
          }
        } else if (admin.ldap_dn) {
          // LDAP管理员，使用LDAP认证
          const ldapAuth = await this.authenticateLDAPAdmin(username, password);
          if (!ldapAuth) {
            console.log(`LDAP管理员认证失败: ${username}`);
            return null;
          }
        } else {
          console.log(`管理员认证配置错误: ${username}`);
          return null;
        }

        // 生成JWT token
        const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
          id: admin.id,
          username: admin.username,
          role: 'admin',
        };

        const token = this.generateToken(tokenPayload);

        console.log(`管理员登录成功: ${username}`);
        return {
          admin,
          token,
        };
      } else {
        // 检查是否是配置的LDAP管理员
        const ldapAdminUsers = process.env.LDAP_ADMIN_USERS;
        const ldapAdminEnabled = process.env.LDAP_ADMIN_LOGIN_ENABLED === 'true';
        
        if (ldapAdminEnabled && ldapAdminUsers) {
          const adminUsernames = ldapAdminUsers.split(',').map(u => u.trim());
          
          if (adminUsernames.includes(username)) {
            // 尝试LDAP认证
            const ldapAuth = await this.authenticateLDAPAdmin(username, password);
            if (ldapAuth) {
              // 动态创建管理员记录
              const newAdmin = await this.createAdminFromLDAP(ldapAuth);
              if (newAdmin) {
                const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
                  id: newAdmin.id,
                  username: newAdmin.username,
                  role: 'admin',
                };

                const token = this.generateToken(tokenPayload);

                console.log(`LDAP管理员登录成功: ${username}`);
                return {
                  admin: newAdmin,
                  token,
                };
              }
            }
          }
        }

        console.log(`管理员不存在: ${username}`);
        return null;
      }
    } catch (error) {
      console.error('管理员认证过程出错:', error);
      return null;
    }
  }

  static async refreshToken(oldToken: string): Promise<string | null> {
    try {
      const decoded = this.verifyToken(oldToken);
      if (!decoded) {
        return null;
      }

      // 验证用户是否仍然有效
      if (decoded.role === 'pi') {
        const pi = await PIModel.findById(decoded.id);
        if (!pi || !pi.is_active) {
          return null;
        }
      } else if (decoded.role === 'admin') {
        const admin = await AdminModel.findById(decoded.id);
        if (!admin || !admin.is_active) {
          return null;
        }
      }

      // 生成新token
      const newTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
      };

      return this.generateToken(newTokenPayload);
    } catch (error) {
      console.error('刷新token失败:', error);
      return null;
    }
  }

  static async validateUser(userId: number, role: 'pi' | 'admin'): Promise<PIInfo | Admin | null> {
    try {
      if (role === 'pi') {
        return await PIModel.findById(userId);
      } else {
        return await AdminModel.findById(userId);
      }
    } catch (error) {
      console.error('验证用户失败:', error);
      return null;
    }
  }

  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7); // 移除 "Bearer " 前缀
  }

  private static async authenticateLDAPAdmin(username: string, password: string): Promise<any | null> {
    try {
      // 使用LDAP验证管理员身份
      const ldapUserInfo = await ldapService.authenticatePI(username, password);
      return ldapUserInfo;
    } catch (error) {
      console.error('LDAP管理员认证失败:', error);
      return null;
    }
  }

  private static async createAdminFromLDAP(ldapUserInfo: any): Promise<Admin | null> {
    try {
      // 检查是否已存在
      const existingAdmin = await AdminModel.findByUsername(ldapUserInfo.username);
      if (existingAdmin) {
        return existingAdmin;
      }

      // 创建新的管理员记录
      const newAdmin = await AdminModel.create({
        username: ldapUserInfo.username,
        full_name: ldapUserInfo.full_name,
        email: ldapUserInfo.email,
        ldap_dn: ldapUserInfo.ldap_dn,
        role: 'admin',
      });

      console.log(`从LDAP创建管理员: ${ldapUserInfo.username}`);
      return newAdmin;
    } catch (error) {
      console.error('创建LDAP管理员失败:', error);
      return null;
    }
  }

  static hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  static comparePassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  }
}