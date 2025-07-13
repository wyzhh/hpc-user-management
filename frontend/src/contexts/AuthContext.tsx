import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, userType: 'pi' | 'admin') => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化用户状态
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      
      try {
        // 检查是否已登录
        if (authService.isAuthenticated()) {
          const storedUser = authService.getCurrentUserFromStorage();
          if (storedUser) {
            console.log('初始化认证状态，用户类型:', storedUser.user_type);
            setUser(storedUser);
            setIsAuthenticated(true);
            
            // 尝试验证当前用户信息是否有效
            try {
              await refreshUser();
            } catch (error) {
              console.error('验证用户信息失败，执行登出:', error);
              await logout();
            }
          } else {
            console.log('无有效用户信息，清理状态');
            await logout();
          }
        } else {
          console.log('用户未认证');
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('初始化认证状态失败:', error);
        await logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // 定期检查token是否需要刷新
  useEffect(() => {
    if (!isAuthenticated) return;

    const intervalId = setInterval(async () => {
      try {
        await authService.autoRefreshToken();
      } catch (error) {
        console.error('自动刷新token失败:', error);
        await logout();
      }
    }, 5 * 60 * 1000); // 每5分钟检查一次

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  const login = async (
    username: string, 
    password: string, 
    userType: 'pi' | 'admin'
  ): Promise<{ success: boolean; message: string }> => {
    try {
      setIsLoading(true);
      
      // 先清理旧状态
      setUser(null);
      setIsAuthenticated(false);
      
      const response = await authService.login({ username, password }, userType);
      
      if (response.success && response.data) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        console.log('登录成功，用户类型:', response.data.user.user_type);
        return { success: true, message: '登录成功' };
      } else {
        return { success: false, message: response.message || '登录失败' };
      }
    } catch (error) {
      console.error('登录错误:', error);
      return { success: false, message: '登录过程中发生错误' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // 立即清理状态
      setUser(null);
      setIsAuthenticated(false);
      
      // 调用API登出并清理localStorage
      await authService.logout();
      
      console.log('用户已登出');
    } catch (error) {
      console.error('登出错误:', error);
    } finally {
      // 确保状态被清理
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await authService.getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data);
        // 更新localStorage中的用户信息
        localStorage.setItem('user', JSON.stringify(response.data));
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error);
      // 如果刷新失败，可能token已过期，执行登出
      await logout();
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// 自定义Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
};

export default AuthContext;