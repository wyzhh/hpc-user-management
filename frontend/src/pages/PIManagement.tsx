import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Input,
  Row,
  Col,
  Statistic,
  Typography,
  Tooltip,
  Popconfirm
} from 'antd';
import {
  UserAddOutlined,
  UserDeleteOutlined,
  SearchOutlined,
  TeamOutlined,
  CrownOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { User, PIManagementStats } from '../types';
import { piManagementService } from '../services/piManagement';

const { Title, Text } = Typography;
const { Search } = Input;

interface PIManagementProps {}

const PIManagement: React.FC<PIManagementProps> = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PIManagementStats | null>(null);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 加载数据
  const loadData = async (page = 1, pageSize = 20, search = '') => {
    setLoading(true);
    try {
      const [usersResponse, statsResponse] = await Promise.all([
        piManagementService.getUsersForPIAssignment(page, pageSize, search),
        piManagementService.getStats()
      ]);

      if (usersResponse.success && usersResponse.data) {
        setUsers(usersResponse.data.users);
        setPagination({
          current: page,
          pageSize,
          total: usersResponse.data.total
        });
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 搜索用户
  const handleSearch = (value: string) => {
    setSearchText(value);
    loadData(1, pagination.pageSize, value);
  };

  // 分页变化
  const handleTableChange = (paginationConfig: any) => {
    const { current, pageSize } = paginationConfig;
    loadData(current, pageSize, searchText);
  };

  // 设置用户为PI
  const handleAssignAsPI = async (userId: number, username: string) => {
    try {
      const response = await piManagementService.assignUserAsPI(userId);
      if (response.success) {
        message.success(`用户 ${username} 已设置为PI`);
        loadData(pagination.current, pagination.pageSize, searchText);
      } else {
        message.error(response.message || '设置PI失败');
      }
    } catch (error) {
      message.error('设置PI失败');
    }
  };

  // 移除PI角色
  const handleRemoveFromPI = async (userId: number, username: string) => {
    try {
      const response = await piManagementService.removeUserFromPI(userId);
      if (response.success) {
        message.success(`用户 ${username} 的PI角色已移除`);
        loadData(pagination.current, pagination.pageSize, searchText);
      } else {
        message.error(response.message || '移除PI角色失败');
      }
    } catch (error) {
      message.error('移除PI角色失败');
    }
  };

  // 获取用户类型标签
  const getUserTypeTag = (userType: string) => {
    switch (userType) {
      case 'pi':
        return <Tag color="gold" icon={<CrownOutlined />}>PI</Tag>;
      case 'student':
        return <Tag color="blue" icon={<UserOutlined />}>学生</Tag>;
      case 'unassigned':
        return <Tag color="default">未分配</Tag>;
      default:
        return <Tag color="default">{userType}</Tag>;
    }
  };

  // 表格列定义
  const columns: ColumnsType<User> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      fixed: 'left',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 150,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: 'UID',
      dataIndex: 'uid_number',
      key: 'uid_number',
      width: 80,
    },
    {
      title: 'GID',
      dataIndex: 'gid_number',
      key: 'gid_number',
      width: 80,
    },
    {
      title: '当前角色',
      dataIndex: 'user_type',
      key: 'user_type',
      width: 100,
      render: (userType: string) => getUserTypeTag(userType),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '活跃' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.user_type !== 'pi' ? (
            <Tooltip title="设置为PI用户">
              <Popconfirm
                title={`确定要将用户 ${record.username} 设置为PI吗？`}
                onConfirm={() => handleAssignAsPI(record.id, record.username)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<UserAddOutlined />}
                  disabled={!record.is_active}
                >
                  设为PI
                </Button>
              </Popconfirm>
            </Tooltip>
          ) : (
            <Tooltip title="移除PI角色">
              <Popconfirm
                title={`确定要移除用户 ${record.username} 的PI角色吗？`}
                description="如果该PI还有学生，将无法移除"
                onConfirm={() => handleRemoveFromPI(record.id, record.username)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  size="small"
                  icon={<UserDeleteOutlined />}
                >
                  移除PI
                </Button>
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <TeamOutlined /> PI管理
      </Title>
      <Text type="secondary">
        管理系统中的PI用户，可以将普通用户设置为PI，或移除PI角色
      </Text>

      {/* 统计信息 */}
      {stats && (
        <Row gutter={16} style={{ marginTop: '24px', marginBottom: '24px' }}>
          <Col span={4}>
            <Card>
              <Statistic
                title="总用户数"
                value={stats.total_users}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="PI用户"
                value={stats.total_pis}
                prefix={<CrownOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="学生用户"
                value={stats.total_students}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="未分配角色"
                value={stats.unassigned_users}
                valueStyle={{ color: '#8c8c8c' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="活跃PI"
                value={stats.active_pis}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="非活跃PI"
                value={stats.inactive_pis}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 用户列表 */}
      <Card>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <Search
            placeholder="搜索用户名、姓名或邮箱"
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            enterButton={<SearchOutlined />}
          />
          <Button
            icon={<SearchOutlined />}
            onClick={() => loadData(pagination.current, pagination.pageSize, searchText)}
          >
            刷新
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          loading={loading}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>
    </div>
  );
};

export default PIManagement;