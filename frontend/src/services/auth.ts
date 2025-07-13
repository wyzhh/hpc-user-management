import { apiCall } from './api';
import { LoginRequest, LoginResponse, User, ApiResponse } from '../types';

class AuthService {
  // 登录
  async login(credentials: LoginRequest, userType: 'pi' | 'admin'): Promise<ApiResponse<LoginResponse>> {
    const endpoint = userType === 'pi' ? '/auth/login/pi' : '/auth/login/admin';
    const response = await apiCall<LoginResponse>('POST', endpoint, credentials);
    
    if (response.success && response.data) {
      // 保存token和用户信息到localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('tokenExpires', response.data.expires.toString());
    }
    
    return response;
  }

  // 登出
  async logout(): Promise<void> {
    try {
      await apiCall('POST', '/auth/logout');
    } catch (error) {
      console.error('登出请求失败:', error);
    } finally {
      // 清除本地存储
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('tokenExpires');
    }
  }

  // 刷新token
  async refreshToken(): Promise<boolean> {
    try {
      const response = await apiCall<{ token: string; expires: number }>('POST', '/auth/refresh');
      
      if (response.success && response.data) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('tokenExpires', response.data.expires.toString());
        return true;
      }
    } catch (error) {
      console.error('刷新token失败:', error);
    }
    
    return false;
  }

  // 获取当前用户信息
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return await apiCall<User>('GET', '/auth/me');
  }

  // 检查是否已登录
  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    const expires = localStorage.getItem('tokenExpires');
    
    if (!token || !expires) {
      return false;
    }
    
    // 检查token是否过期
    const expiresTime = parseInt(expires, 10);
    const now = Date.now();
    
    if (now >= expiresTime) {
      this.logout();
      return false;
    }
    
    return true;
  }

  // 获取当前用户信息（从localStorage）
  getCurrentUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return null;
    }
    
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('解析用户信息失败:', error);
      return null;
    }
  }

  // 获取用户角色
  getUserRole(): 'pi' | 'admin' | null {
    const user = this.getCurrentUserFromStorage();
    // 新架构中，用户类型不包含admin，暂时返回null
    return user?.user_type === 'pi' ? 'pi' : null;
  }

  // 检查用户权限
  hasRole(role: 'pi' | 'admin'): boolean {
    const userRole = this.getUserRole();
    return userRole === role;
  }

  // 检查用户是否有任一权限
  hasAnyRole(roles: ('pi' | 'admin')[]): boolean {
    const userRole = this.getUserRole();
    return userRole ? roles.includes(userRole) : false;
  }

  // 获取token
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  // 检查token是否即将过期（30分钟内）
  isTokenExpiringSoon(): boolean {
    const expires = localStorage.getItem('tokenExpires');
    if (!expires) {
      return false;
    }
    
    const expiresTime = parseInt(expires, 10);
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000; // 30分钟
    
    return (expiresTime - now) <= thirtyMinutes;
  }

  // 自动刷新token（如果即将过期）
  async autoRefreshToken(): Promise<void> {
    if (this.isAuthenticated() && this.isTokenExpiringSoon()) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        console.warn('自动刷新token失败，用户需要重新登录');
        this.logout();
      }
    }
  }
}

// 创建单例实例
export const authService = new AuthService();
export default authService;