import jwt from 'jsonwebtoken';
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
        console.log(`用户 ${username} 在PI表中不存在，但尝试作为PI登录`);
        return null;
      } else {
        // PI记录已存在，更新users表中的信息（如果需要）
        // 这里我们可以选择性地更新users表，但为简单起见，我们跳过更新
        console.log(`PI用户登录成功: ${username}`);
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

  static async authenticateAdmin(username: string, password: string): Promise<{ admin: Admin; token: string } | { error: string; code: number } | null> {
    try {
      // 直接使用LDAP认证
      const ldapAuth = await ldapService.authenticatePI(username, password);
      if (!ldapAuth) {
        console.log(`管理员LDAP认证失败: ${username}`);
        return null;
      }

      // 检查用户是否在管理员表中
      const admin = await AdminModel.findByUsername(username);
      if (!admin) {
        console.log(`用户不是管理员: ${username}`);
        return { error: '用户不是管理员', code: 403 };
      }
      if (!admin.is_active) {
        console.log(`管理员账户已被禁用: ${username}`);
        return { error: '管理员账户已被禁用', code: 403 };
      }

      // 生成JWT token
      const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        id: admin.id,
        username: admin.username,
        role: 'admin',
      };

      const token = this.generateToken(tokenPayload);

      console.log(`管理员LDAP登录成功: ${username}`);
      return {
        admin,
        token,
      };
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

}