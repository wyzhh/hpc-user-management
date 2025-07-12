import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import './App.css';

// 错误页面组件
const NotFound: React.FC = () => (
  <div style={{ textAlign: 'center', padding: '50px' }}>
    <h1>404 - 页面不存在</h1>
    <p>您访问的页面不存在，请检查URL是否正确。</p>
    <a href="/dashboard">返回首页</a>
  </div>
);

const Unauthorized: React.FC = () => (
  <div style={{ textAlign: 'center', padding: '50px' }}>
    <h1>403 - 权限不足</h1>
    <p>您没有权限访问此页面。</p>
    <a href="/dashboard">返回首页</a>
  </div>
);

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* 公开路由 */}
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              
              {/* 受保护的路由 */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                {/* 仪表板 - 所有角色都可以访问 */}
                <Route path="dashboard" element={<Dashboard />} />
                
                {/* PI用户路由 */}
                <Route
                  path="students/*"
                  element={
                    <ProtectedRoute requiredRoles={['pi']}>
                      <div>学生管理页面（待实现）</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="requests/*"
                  element={
                    <ProtectedRoute requiredRoles={['pi']}>
                      <div>申请记录页面（待实现）</div>
                    </ProtectedRoute>
                  }
                />
                
                {/* 管理员路由 */}
                <Route
                  path="admin/requests/*"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <div>申请审核页面（待实现）</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/users/*"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <div>用户管理页面（待实现）</div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/settings/*"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <div>系统设置页面（待实现）</div>
                    </ProtectedRoute>
                  }
                />
                
                {/* 通用路由 */}
                <Route
                  path="profile"
                  element={
                    <ProtectedRoute>
                      <div>个人信息页面（待实现）</div>
                    </ProtectedRoute>
                  }
                />
                
                {/* 默认重定向 */}
                <Route path="" element={<Navigate to="/dashboard" replace />} />
              </Route>
              
              {/* 404页面 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;