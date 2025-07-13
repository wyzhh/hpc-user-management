import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Tag, 
  Space, 
  Button, 
  Alert, 
  Progress,
  Typography,
  Divider
} from 'antd';
import { 
  UserOutlined, 
  TeamOutlined,
  CrownOutlined,
  ExclamationCircleOutlined,
  CloudServerOutlined,
  ImportOutlined,
  SettingOutlined,
  BarChartOutlined,
  SyncOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { roleAssignmentService } from '../services/roleAssignment';
import { userImportService } from '../services/userImport';
import { UserStats, RoleAssignmentStats, SyncLog, User } from '../types';
import UserImportModal from '../components/user/UserImportModal';

const { Title, Text } = Typography;

const EnhancedDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [roleStats, setRoleStats] = useState<RoleAssignmentStats | null>(null);
  const [lastSync, setLastSync] = useState<SyncLog | null>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [importModalVisible, setImportModalVisible] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 并行加载各种数据
      const [usersResponse, roleStatsResponse, lastSyncResponse] = await Promise.all([
        roleAssignmentService.getAllUsers(1, 10), // 获取前10个用户
        roleAssignmentService.getRoleAssignmentStats(),
        userImportService.getLastSyncStatus()
      ]);

      if (usersResponse.success && usersResponse.data) {
        const users = usersResponse.data.users;
        setRecentUsers(users);
        
        // 计算用户统计
        const stats: UserStats = {
          total: usersResponse.data.total,
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
      console.error('加载仪表板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算角色分配完成率
  const getRoleAssignmentProgress = () => {
    if (!userStats || userStats.total === 0) return 0;
    const assigned = (userStats.by_type.pi || 0) + (userStats.by_type.student || 0);
    return Math.round((assigned / userStats.total) * 100);
  };

  // 渲染同步状态卡片
  const renderSyncStatusCard = () => {
    if (!lastSync) {
      return (
        <Card>
          <Alert
            message="尚未进行LDAP同步"
            description="建议先从LDAP导入用户数据"
            type="warning"
            showIcon
            action={
              <Button
                size="small"
                type="primary"
                onClick={() => setImportModalVisible(true)}
              >
                立即导入
              </Button>
            }
          />
        </Card>
      );
    }

    const statusColor = userImportService.getSyncStatusColor(lastSync);
    const statusText = userImportService.getSyncStatusText(lastSync);

    return (
      <Card>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>
            {statusColor === 'green' ? (
              <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            ) : statusColor === 'red' ? (
              <ExclamationCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
            ) : (
              <SyncOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            )}
          </div>
          <Title level={4} style={{ margin: 0 }}>{statusText}</Title>
          <Text type="secondary">
            {new Date(lastSync.started_at).toLocaleString()}
          </Text>
          <Divider />
          <Space>
            <Text>新增: {lastSync.new_users}</Text>
            <Text>更新: {lastSync.updated_users}</Text>
            <Text>删除: {lastSync.deleted_users}</Text>
          </Space>
        </div>
      </Card>
    );
  };

  // 用户表格列定义
  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 120,
    },
    {
      title: '角色',
      dataIndex: 'user_type',
      key: 'user_type',
      width: 100,
      render: (userType: string) => (
        <Tag 
          color={roleAssignmentService.getUserTypeColor(userType)}
          icon={userType === 'pi' ? <CrownOutlined /> : userType === 'student' ? <TeamOutlined /> : undefined}
        >
          {roleAssignmentService.getUserTypeText(userType)}
        </Tag>
      ),
    },
    {
      title: '课题组',
      dataIndex: 'gid_number',
      key: 'gid_number',
      width: 100,
      render: (gidNumber: number) => (
        gidNumber ? (
          <Tag color="blue">GID: {gidNumber}</Tag>
        ) : (
          <Text type="secondary">未分配</Text>
        )
      )
    },
    {
      title: '同步时间',
      dataIndex: 'last_sync_at',
      key: 'last_sync_at',
      width: 140,
      render: (text: string) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {new Date(text).toLocaleDateString()}
        </Text>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          HPC用户管理系统
        </Title>
        <Text type="secondary">
          欢迎回来，{user?.full_name || user?.username}
          {/* 暂时移除admin标签 */}
        </Text>
      </div>

      {/* 主要统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="用户总数"
              value={userStats?.total || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="未分配角色"
              value={userStats?.by_type.unassigned || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
              suffix={
                userStats?.total ? (
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    / {userStats.total}
                  </span>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="PI用户"
              value={userStats?.by_type.pi || 0}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="学生用户"
              value={userStats?.by_type.student || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* 角色分配进度 */}
        <Col xs={24} lg={8}>
          <Card title="角色分配进度" loading={loading}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={getRoleAssignmentProgress()}
                strokeColor={{
                  '0%': '#faad14',
                  '100%': '#52c41a',
                }}
                style={{ marginBottom: 16 }}
              />
              <div>
                <Text>已分配角色: {(userStats?.by_type.pi || 0) + (userStats?.by_type.student || 0)}</Text>
                <br />
                <Text type="secondary">总用户数: {userStats?.total || 0}</Text>
              </div>
            </div>
          </Card>
        </Col>

        {/* LDAP同步状态 */}
        <Col xs={24} lg={8}>
          <Card title="LDAP同步状态" loading={loading}>
            {renderSyncStatusCard()}
          </Card>
        </Col>

        {/* 系统健康状态 */}
        <Col xs={24} lg={8}>
          <Card title="系统状态" loading={loading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>活跃用户: </Text>
                <Tag color="green">{userStats?.active || 0}</Tag>
              </div>
              <div>
                <Text>LDAP已删除: </Text>
                <Tag color={userStats?.deleted_from_ldap ? 'orange' : 'green'}>
                  {userStats?.deleted_from_ldap || 0}
                </Tag>
              </div>
              <div>
                <Text>课题组数量: </Text>
                <Tag color="blue">{roleStats?.by_research_group?.length || 0}</Tag>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 最近导入的用户 */}
        <Col xs={24} lg={16}>
          <Card
            title="最近导入的用户"
            extra={
              <Button type="link" onClick={() => navigate('/users')}>
                查看全部
              </Button>
            }
          >
            <Table
              columns={userColumns}
              dataSource={recentUsers}
              pagination={false}
              size="small"
              rowKey="id"
              loading={loading}
              locale={{ emptyText: '暂无用户数据，请先从LDAP导入用户' }}
            />
          </Card>
        </Col>

        {/* 快速操作 */}
        <Col xs={24} lg={8}>
          <Card title="快速操作">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<ImportOutlined />}
                block
                onClick={() => setImportModalVisible(true)}
              >
                导入LDAP用户
              </Button>
              
              {userStats && userStats.by_type.unassigned > 0 && (
                <Button
                  icon={<UserOutlined />}
                  block
                  onClick={() => navigate('/users')}
                >
                  分配用户角色 ({userStats.by_type.unassigned})
                </Button>
              )}
              
              <Button
                icon={<BarChartOutlined />}
                block
                onClick={() => navigate('/users')}
              >
                用户管理
              </Button>
              
              {roleStats && roleStats.by_research_group && roleStats.by_research_group.length > 0 && (
                <Button
                  icon={<TeamOutlined />}
                  block
                  onClick={() => navigate('/users')}
                >
                  课题组管理 ({roleStats.by_research_group.length})
                </Button>
              )}
              
              <Button
                icon={<SettingOutlined />}
                block
                onClick={() => navigate('/users')}
              >
                系统设置
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 系统提示 */}
      {userStats && (
        <Card style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {userStats.total === 0 && (
              <Alert
                message="系统尚未导入用户"
                description="请先从LDAP服务器导入用户数据，然后进行角色分配。"
                type="warning"
                showIcon
                action={
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => setImportModalVisible(true)}
                  >
                    立即导入
                  </Button>
                }
              />
            )}
            
            {userStats.by_type.unassigned > 0 && (
              <Alert
                message={`有 ${userStats.by_type.unassigned} 个用户尚未分配角色`}
                description="建议及时为这些用户分配PI或学生角色，以便进行权限管理。"
                type="info"
                showIcon
                action={
                  <Button
                    size="small"
                    onClick={() => navigate('/users')}
                  >
                    去分配
                  </Button>
                }
              />
            )}
            
            {userStats.deleted_from_ldap > 0 && (
              <Alert
                message={`发现 ${userStats.deleted_from_ldap} 个用户已从LDAP删除`}
                description="这些用户在LDAP中已不存在，但系统中保留了记录。建议定期清理或归档。"
                type="warning"
                showIcon
              />
            )}
          </Space>
        </Card>
      )}

      {/* 用户导入模态框 */}
      <UserImportModal
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onSuccess={loadDashboardData}
      />
    </div>
  );
};

export default EnhancedDashboard;