import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ('pi' | 'admin')[];
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
    
    if (!requiredRoles.includes(user.role)) {
      console.log(`权限检查失败：用户角色 "${user.role}" 不在要求的角色 [${requiredRoles.join(', ')}] 中`);
      return <Navigate to="/unauthorized" replace />;
    }
    
    console.log(`权限检查通过：用户角色 "${user.role}" 符合要求 [${requiredRoles.join(', ')}]`);
  }

  return <>{children}</>;
};

export default ProtectedRoute;