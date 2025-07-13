import React, { useState, useEffect } from 'react';
import { Card, Space, Statistic, Row, Col, message } from 'antd';
import { UserOutlined, UsergroupAddOutlined, CheckCircleOutlined } from '@ant-design/icons';
import UserList from '../components/user/UserList';
import UserModal from '../components/user/UserModal';
import { PIUser, AdminUser, StudentUser, userService } from '../services/user';


interface UserStats {
  total_users: number;
  active_users: number;
}

const UserManagement: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [modalUserType, setModalUserType] = useState<'pi' | 'admin' | 'student'>('pi');
  const [selectedUser, setSelectedUser] = useState<PIUser | AdminUser | StudentUser | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // 加载统计数据
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const response = await userService.getUserStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 初始加载统计数据
  useEffect(() => {
    loadStats();
  }, []);

  // 创建用户 - 暂时不使用
  // const handleCreateUser = (userType: 'pi' | 'admin' | 'student' = 'admin') => {
  //   setSelectedUser(null);
  //   setModalUserType(userType);
  //   setModalMode('create');
  //   setModalVisible(true);
  // };

  // 查看用户
  const handleViewUser = (user: PIUser | AdminUser | StudentUser, userType: 'pi' | 'admin' | 'student') => {
    setSelectedUser(user);
    setModalUserType(userType);
    setModalMode('view');
    setModalVisible(true);
  };

  // 编辑用户
  const handleEditUser = (user: PIUser | AdminUser | StudentUser, userType: 'pi' | 'admin' | 'student') => {
    setSelectedUser(user);
    setModalUserType(userType);
    setModalMode('edit');
    setModalVisible(true);
  };

  // 重置密码 - 暂时不使用
  // const handleResetPassword = async (user: AdminUser) => {
  //   try {
  //     const newPassword = Math.random().toString(36).slice(-12) + 'A1!';
  //     const response = await userService.resetAdminPassword(user.id, newPassword);
      
  //     if (response.success) {
  //       message.success(`密码重置成功！新密码：${newPassword}`, 10);
  //       // 触发列表刷新
  //       setRefreshKey(prev => prev + 1);
  //     } else {
  //       message.error('重置密码失败: ' + response.message);
  //     }
  //   } catch (error) {
  //     message.error('重置密码失败');
  //     console.error('Reset password error:', error);
  //   }
  // };

  // 模态框成功回调
  const handleModalSuccess = () => {
    setModalVisible(false);
    setSelectedUser(null);
    // 触发列表刷新
    setRefreshKey(prev => prev + 1);
    // 重新加载统计数据
    loadStats();
  };

  // 关闭模态框
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedUser(null);
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>用户管理</h1>
        <p style={{ margin: '8px 0 0 0', color: '#666' }}>
          管理系统中的所有LDAP用户账户
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card loading={statsLoading}>
            <Statistic
              title="用户总数"
              value={stats?.total_users || 0}
              prefix={<UsergroupAddOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={statsLoading}>
            <Statistic
              title="活跃用户"
              value={stats?.active_users || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={statsLoading}>
            <Statistic
              title="活跃用户率"
              value={
                stats?.total_users 
                  ? Math.round((stats.active_users / stats.total_users) * 100)
                  : 0
              }
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* 主要内容区域 */}
      <Card>
        <UserList
          key={`all_users-${refreshKey}`}
          userType="all_users"
          onViewUser={(user) => handleViewUser(user, 'pi')}
          onEditUser={(user) => handleEditUser(user, 'pi')}
        />
      </Card>

      {/* 用户模态框 */}
      <UserModal
        visible={modalVisible}
        mode={modalMode}
        userType={modalUserType}
        user={selectedUser}
        onSuccess={handleModalSuccess}
        onCancel={handleCloseModal}
      />
    </div>
  );
};

export default UserManagement;