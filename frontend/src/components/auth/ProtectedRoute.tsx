import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: ('pi' | 'admin' | 'student' | 'unassigned')[];
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
  if (roles.length > 0) {
    // 获取用户角色：管理员用户使用 role 字段，其他用户使用 user_type 字段
    const userRole = user.role || user.user_type;
    
    if (!userRole || !roles.includes(userRole as any)) {
      // 根据用户类型重定向到对应的首页
      const defaultPath = '/dashboard'; // 暂时简化，所有用户都去dashboard
      return <Navigate to={defaultPath} replace />;
    }
  }

  // 通过所有检查，渲染子组件
  return <>{children}</>;
};

export default ProtectedRoute;