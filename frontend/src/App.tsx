import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StudentManagement from './pages/StudentManagement';
import AdminStudentManagement from './pages/AdminStudentManagement';
import RequestManagement from './pages/RequestManagement';
import UserManagement from './pages/UserManagement';
import PIManagement from './pages/PIManagement';
import InitializationPage from './pages/Initialization';
import axios from 'axios';
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

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // 检查系统初始化状态
  const checkInitializationStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/initialization/status`);
      const status = response.data.data;
      setIsInitialized(status.isInitialized);
      console.log('系统初始化状态:', status);
    } catch (error) {
      console.error('检查初始化状态失败:', error);
      // 如果无法连接到后端，假设需要初始化
      setIsInitialized(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkInitializationStatus();
  }, []);

  // 如果正在检查状态，显示加载动画
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" tip="正在检查系统状态..." />
      </div>
    );
  }

  // 如果系统未初始化，直接显示初始化页面
  if (isInitialized === false) {
    return (
      <ConfigProvider locale={zhCN}>
        <Router>
          <Routes>
            <Route path="*" element={<InitializationPage />} />
          </Routes>
        </Router>
      </ConfigProvider>
    );
  }

  // 系统已初始化，显示正常的应用程序
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* 公开路由 */}
              <Route path="/login" element={<Login />} />
              <Route path="/initialization" element={<InitializationPage />} />
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
                
                {/* 课题组长路由 */}
                <Route
                  path="students/*"
                  element={
                    <ProtectedRoute requiredRoles={['pi']}>
                      <StudentManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="requests/*"
                  element={
                    <ProtectedRoute requiredRoles={['pi']}>
                      <RequestManagement />
                    </ProtectedRoute>
                  }
                />
                
                {/* 管理员路由 */}
                <Route
                  path="admin/pi-management"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <PIManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/student-management"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <AdminStudentManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/requests/*"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <RequestManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/users/*"
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <UserManagement />
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