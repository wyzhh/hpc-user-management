import React, { useState, useEffect } from 'react';
import { Card, Space, Statistic, Row, Col, message } from 'antd';
import { UserOutlined, UsergroupAddOutlined, CheckCircleOutlined } from '@ant-design/icons';
import UserList from '../components/user/UserList';
import UserModal from '../components/user/UserModal';
import UserEditModal from '../components/user/UserEditModal';
import { PIUser, AdminUser, StudentUser, userService } from '../services/user';
import { User } from '../types';


interface UserStats {
  total_users: number;
  active_users: number;
}

const UserManagement: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [modalUserType, setModalUserType] = useState<'pi' | 'admin' | 'student'>('pi');
  const [selectedUser, setSelectedUser] = useState<PIUser | AdminUser | StudentUser | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
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

  // 编辑用户 - 使用新的编辑模态框
  const handleEditUser = (user: PIUser | AdminUser | StudentUser, userType: 'pi' | 'admin' | 'student') => {
    // 转换用户类型映射
    let mappedUserType: 'pi' | 'student' | 'unassigned';
    if (userType === 'admin') {
      mappedUserType = 'unassigned'; // 管理员映射为未分配
    } else {
      mappedUserType = userType as 'pi' | 'student';
    }

    // 转换为User类型
    const editUser: User = {
      id: user.id,
      username: user.username,
      full_name: (user as any).full_name || (user as any).chinese_name,
      email: user.email,
      phone: (user as any).phone || '',
      user_type: mappedUserType,
      is_active: (user as any).is_active || true,
      is_deleted_from_ldap: false,
      ldap_dn: (user as any).ldap_dn || '',
      uid_number: (user as any).uid_number || 0,
      gid_number: (user as any).gid_number || 0,
      home_directory: (user as any).home_directory || '',
      login_shell: (user as any).login_shell || '',
      created_at: (user as any).created_at || '',
      updated_at: (user as any).updated_at || '',
      last_sync_at: (user as any).last_sync_at || ''
    };
    setEditingUser(editUser);
    setEditModalVisible(true);
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

  // 编辑模态框成功回调
  const handleEditModalSuccess = () => {
    setEditModalVisible(false);
    setEditingUser(null);
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

      {/* 用户查看模态框 */}
      <UserModal
        visible={modalVisible}
        mode={modalMode}
        userType={modalUserType}
        user={selectedUser}
        onSuccess={handleModalSuccess}
        onCancel={handleCloseModal}
      />

      {/* 用户编辑模态框 */}
      <UserEditModal
        visible={editModalVisible}
        user={editingUser}
        onCancel={() => setEditModalVisible(false)}
        onSuccess={handleEditModalSuccess}
      />
    </div>
  );
};

export default UserManagement;