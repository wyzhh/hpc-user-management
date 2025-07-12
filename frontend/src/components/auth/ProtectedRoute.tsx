import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: ('pi' | 'admin')[];
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  roles = [],
  redirectTo = '/login',
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // 正在加载中
  if (isLoading) {
    return (
      <div 
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 未认证，重定向到登录页
  if (!isAuthenticated || !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // 检查角色权限
  if (roles.length > 0 && !roles.includes(user.role)) {
    // 根据用户角色重定向到对应的首页
    const defaultPath = user.role === 'admin' ? '/admin/dashboard' : '/dashboard';
    return <Navigate to={defaultPath} replace />;
  }

  // 通过所有检查，渲染子组件
  return <>{children}</>;
};

export default ProtectedRoute;