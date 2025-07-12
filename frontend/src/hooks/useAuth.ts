import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { authService } from '../services/auth';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { username: string; password: string }, userType: 'pi' | 'admin') => Promise<boolean>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateUser: (updatedUser: User) => void;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      
      if (authService.isAuthenticated()) {
        const storedUser = authService.getCurrentUserFromStorage();
        if (storedUser) {
          setUser(storedUser);
          
          // 尝试自动刷新token（如果即将过期）
          await authService.autoRefreshToken();
        } else {
          // 如果没有用户信息，尝试从服务器获取
          try {
            const response = await authService.getCurrentUser();
            if (response.success && response.data) {
              setUser(response.data);
            } else {
              authService.logout();
            }
          } catch (error) {
            console.error('获取用户信息失败:', error);
            authService.logout();
          }
        }
      }
      
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // 登录
  const login = useCallback(async (
    credentials: { username: string; password: string },
    userType: 'pi' | 'admin'
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await authService.login(credentials, userType);
      
      if (response.success && response.data) {
        setUser(response.data.user);
        return true;
      } else {
        console.error('登录失败:', response.message);
        return false;
      }
    } catch (error) {
      console.error('登录过程出错:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 登出
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('登出过程出错:', error);
    } finally {
      setUser(null);
    }
  }, []);

  // 刷新token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      return await authService.refreshToken();
    } catch (error) {
      console.error('刷新token失败:', error);
      return false;
    }
  }, []);

  // 更新用户信息
  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, []);

  // 定期检查token状态
  useEffect(() => {
    if (!user) return;

    const checkTokenStatus = () => {
      if (!authService.isAuthenticated()) {
        setUser(null);
        return;
      }

      // 自动刷新即将过期的token
      authService.autoRefreshToken();
    };

    // 每5分钟检查一次
    const interval = setInterval(checkTokenStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshToken,
    updateUser,
  };
};