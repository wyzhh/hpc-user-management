import React, { useState, useEffect } from 'react';
import { Card, Tabs, Space, Statistic, Row, Col, Button, message, Alert } from 'antd';
import { 
  UserOutlined, 
  TeamOutlined, 
  CrownOutlined, 
  ExclamationCircleOutlined,
  ImportOutlined,
  SettingOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import EnhancedUserList from '../components/user/EnhancedUserList';
import UserImportModal from '../components/user/UserImportModal';
import { roleAssignmentService } from '../services/roleAssignment';
import { userImportService } from '../services/userImport';
import { UserStats, RoleAssignmentStats, SyncLog } from '../types';

const { TabPane } = Tabs;

const EnhancedUserManagement: React.FC = () => {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [roleStats, setRoleStats] = useState<RoleAssignmentStats | null>(null);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 加载统计数据
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      // 并行加载各种统计数据
      const [userStatsResponse, roleStatsResponse, lastSyncResponse] = await Promise.all([
        roleAssignmentService.getAllUsers(1, 1), // 只获取统计信息
        roleAssignmentService.getRoleAssignmentStats(),
        userImportService.getLastSyncStatus()
      ]);

      if (userStatsResponse.success && userStatsResponse.data) {
        // 从用户列表响应中提取统计信息
        const users = userStatsResponse.data.users;
        const stats: UserStats = {
          total: userStatsResponse.data.total,
          by_type: {
            unassigned: users.filter(u => u.user_type === 'unassigned').length,
            pi: users.filter(u => u.user_type === 'pi').length,
            student: users.filter(u => u.user_type === 'student').length
          },
          active: users.filter(u => u.is_active).length,
          deleted_from_ldap: users.filter(u => u.is_deleted_from_ldap).length
        };
        setUserStats(stats);
      }

      if (roleStatsResponse.success && roleStatsResponse.data) {
        setRoleStats(roleStatsResponse.data);
      }

      if (lastSyncResponse.success && lastSyncResponse.data) {
        setLastSync(lastSyncResponse.data);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 初始加载统计数据
  useEffect(() => {
    loadStats();
  }, [refreshKey]);

  // 刷新数据
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // 渲染统计卡片
  const renderStatsCards = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card loading={statsLoading}>
          <Statistic
            title="用户总数"
            value={userStats?.total || 0}
            prefix={<UserOutlined />}
            valueStyle={{ color: '#1890ff' }}
            suffix={
              <span style={{ fontSize: '14px', color: '#666' }}>
                (活跃: {userStats?.active || 0})
              </span>
            }
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={statsLoading}>
          <Statistic
            title="未分配角色"
            value={userStats?.by_type.unassigned || 0}
            prefix={<ExclamationCircleOutlined />}
            valueStyle={{ color: '#faad14' }}
            suffix={
              userStats?.total ? (
                <span style={{ fontSize: '12px', color: '#666' }}>
                  ({Math.round(((userStats.by_type.unassigned || 0) / userStats.total) * 100)}%)
                </span>
              ) : null
            }
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={statsLoading}>
          <Statistic
            title="PI用户"
            value={userStats?.by_type.pi || 0}
            prefix={<CrownOutlined />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={statsLoading}>
          <Statistic
            title="学生用户"
            value={userStats?.by_type.student || 0}
            prefix={<TeamOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
    </Row>
  );

  // 渲染同步状态
  const renderSyncStatus = () => {
    if (!lastSync) return null;

    const statusColor = userImportService.getSyncStatusColor(lastSync);
    const statusText = userImportService.getSyncStatusText(lastSync);

    return (
      <Alert
        message={
          <Space>
            <span>最后同步状态: {statusText}</span>
            <span>|</span>
            <span>同步时间: {new Date(lastSync.started_at).toLocaleString()}</span>
            {lastSync.duration_seconds && (
              <>
                <span>|</span>
                <span>耗时: {lastSync.duration_seconds}秒</span>
              </>
            )}
          </Space>
        }
        type={statusColor === 'green' ? 'success' : statusColor === 'red' ? 'error' : 'info'}
        showIcon
        style={{ marginBottom: 16 }}
        action={
          <Button
            size="small"
            type="primary"
            icon={<ImportOutlined />}
            onClick={() => setImportModalVisible(true)}
          >
            重新导入
          </Button>
        }
      />
    );
  };

  // 渲染课题组统计
  const renderResearchGroupStats = () => {
    if (!roleStats?.by_research_group || roleStats.by_research_group.length === 0) {
      return (
        <Alert
          message="暂无课题组数据"
          description="当用户被分配角色并设置课题组信息后，这里会显示课题组统计信息"
          type="info"
          showIcon
        />
      );
    }

    return (
      <div>
        <h4>课题组分布 (前10个)</h4>
        <Row gutter={16}>
          {roleStats.by_research_group.slice(0, 10).map((group) => (
            <Col span={6} key={group.gid_number} style={{ marginBottom: 16 }}>
              <Card size="small">
                <Statistic
                  title={`课题组 ${group.gid_number}`}
                  value={group.user_count}
                  suffix="人"
                  valueStyle={{ fontSize: '18px' }}
                />
                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                  PI: {group.pi_count} | 学生: {group.student_count}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
          用户管理 - 新架构
        </h1>
        <p style={{ margin: '8px 0 0 0', color: '#666' }}>
          管理从LDAP导入的所有用户，支持角色分配和课题组管理
        </p>
      </div>

      {/* 统计卡片 */}
      {renderStatsCards()}

      {/* 同步状态 */}
      {renderSyncStatus()}

      {/* 主要内容区域 */}
      <Card>
        <Tabs 
          defaultActiveKey="users" 
          size="large"
          tabBarExtraContent={
            <Space>
              <Button
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                导入用户
              </Button>
              <Button
                icon={<BarChartOutlined />}
                onClick={handleRefresh}
              >
                刷新统计
              </Button>
            </Space>
          }
        >
          <TabPane 
            tab={
              <Space>
                <UserOutlined />
                所有用户
                {userStats?.total ? (
                  <span style={{ 
                    backgroundColor: '#1890ff', 
                    color: 'white', 
                    borderRadius: '10px',
                    padding: '0 6px',
                    fontSize: '12px',
                    marginLeft: '4px'
                  }}>{userStats.total}</span>
                ) : null}
              </Space>
            } 
            key="users"
          >
            <EnhancedUserList onRefresh={handleRefresh} />
          </TabPane>
          
          <TabPane 
            tab={
              <Space>
                <ExclamationCircleOutlined />
                未分配角色
                {userStats?.by_type.unassigned ? (
                  <span style={{ 
                    backgroundColor: '#faad14', 
                    color: 'white', 
                    borderRadius: '10px',
                    padding: '0 6px',
                    fontSize: '12px',
                    marginLeft: '4px'
                  }}>{userStats.by_type.unassigned}</span>
                ) : null}
              </Space>
            } 
            key="unassigned"
          >
            <Alert
              message="未分配角色的用户"
              description="这些用户已从LDAP导入，但尚未分配PI或学生角色，请及时进行角色分配。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <EnhancedUserList onRefresh={handleRefresh} />
          </TabPane>

          <TabPane 
            tab={
              <Space>
                <BarChartOutlined />
                课题组统计
                {roleStats?.by_research_group?.length ? (
                  <span style={{ 
                    backgroundColor: '#52c41a', 
                    color: 'white', 
                    borderRadius: '10px',
                    padding: '0 6px',
                    fontSize: '12px',
                    marginLeft: '4px'
                  }}>{roleStats.by_research_group.length}</span>
                ) : null}
              </Space>
            } 
            key="groups"
          >
            <Card>
              {renderResearchGroupStats()}
            </Card>
          </TabPane>

          <TabPane 
            tab={
              <Space>
                <SettingOutlined />
                系统设置
              </Space>
            } 
            key="settings"
          >
            <Card title="导入设置">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                  message="LDAP用户导入"
                  description="定期从LDAP服务器导入用户信息，保持用户数据的同步。建议每天至少执行一次完整导入。"
                  type="info"
                  showIcon
                  action={
                    <Button
                      type="primary"
                      icon={<ImportOutlined />}
                      onClick={() => setImportModalVisible(true)}
                    >
                      立即导入
                    </Button>
                  }
                />
                
                {userStats && userStats.deleted_from_ldap > 0 && (
                  <Alert
                    message={`发现 ${userStats.deleted_from_ldap} 个用户已从LDAP删除`}
                    description="这些用户在LDAP中已不存在，但在系统中保留了记录。建议定期清理或归档这些用户。"
                    type="warning"
                    showIcon
                  />
                )}
              </Space>
            </Card>
          </TabPane>
        </Tabs>
      </Card>

      {/* 用户导入模态框 */}
      <UserImportModal
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
};

export default EnhancedUserManagement;