import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ('pi' | 'admin' | 'student' | 'unassigned')[];
  fallbackPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  fallbackPath = '/login',
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // 显示加载状态
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 未认证，重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // 检查角色权限
  if (requiredRoles && requiredRoles.length > 0) {
    if (!user) {
      console.log('权限检查失败：用户信息为空');
      return <Navigate to="/unauthorized" replace />;
    }
    
    // 获取用户角色：管理员用户使用 role 字段，其他用户使用 user_type 字段
    const userRole = user.role || user.user_type;
    
    if (!userRole || !requiredRoles.includes(userRole as any)) {
      console.log(`权限检查失败：用户角色 "${userRole}" 不在要求的角色 [${requiredRoles.join(', ')}] 中`);
      // 根据用户角色重定向到合适的页面
      const redirectPath = userRole === 'pi' ? '/dashboard' : 
                          userRole === 'admin' ? '/dashboard' : '/login';
      return <Navigate to={redirectPath} replace />;
    }
    
    console.log(`权限检查通过：用户角色 "${userRole}" 符合要求 [${requiredRoles.join(', ')}]`);
  }

  return <>{children}</>;
};

export default ProtectedRoute;