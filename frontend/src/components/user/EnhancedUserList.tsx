import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Row,
  Col,
  Tooltip,
  Popconfirm,
  message,
  Drawer,
  Descriptions,
  Alert,
  Badge,
  Typography
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  UserSwitchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  CrownOutlined,
  ExclamationCircleOutlined,
  FilterOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { roleAssignmentService } from '../../services/roleAssignment';
import { User, UserFilterOptions, PaginationOptions } from '../../types';
import RoleAssignmentModal from './RoleAssignmentModal';
import UserImportModal from './UserImportModal';

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;

interface EnhancedUserListProps {
  onRefresh?: () => void;
}

const EnhancedUserList: React.FC<EnhancedUserListProps> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationOptions>({
    page: 1,
    limit: 20,
    totalPages: 0
  });
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<UserFilterOptions>({});
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<'assign' | 'change'>('assign');

  // 加载用户列表
  const loadUsers = async (page = 1, newFilters?: UserFilterOptions) => {
    setLoading(true);
    try {
      const response = await roleAssignmentService.getAllUsers(
        page,
        pagination.limit,
        newFilters || filters
      );
      
      if (response.success && response.data) {
        setUsers(response.data.users);
        setTotal(response.data.total);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadUsers();
  }, []);

  // 刷新列表
  const handleRefresh = () => {
    loadUsers(pagination.page, filters);
    if (onRefresh) {
      onRefresh();
    }
  };

  // 搜索用户
  const handleSearch = (value: string) => {
    const newFilters = { ...filters, search: value || undefined };
    setFilters(newFilters);
    loadUsers(1, newFilters);
  };

  // 过滤器变更
  const handleFilterChange = (key: keyof UserFilterOptions, value: any) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    loadUsers(1, newFilters);
  };

  // 分页变更
  const handleTableChange = (page: number, pageSize?: number) => {
    const newPagination = { ...pagination, page, limit: pageSize || pagination.limit };
    setPagination(newPagination);
    loadUsers(page, filters);
  };

  // 查看用户详情
  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setDrawerVisible(true);
  };

  // 分配角色
  const handleAssignRole = (user: User) => {
    setSelectedUser(user);
    setRoleModalMode('assign');
    setRoleModalVisible(true);
  };

  // 更改角色
  const handleChangeRole = (user: User) => {
    setSelectedUser(user);
    setRoleModalMode('change');
    setRoleModalVisible(true);
  };

  // 取消角色分配
  const handleUnassignRole = async (user: User) => {
    try {
      const response = await roleAssignmentService.unassignUserRole(user.id);
      if (response.success) {
        message.success('角色已取消分配');
        handleRefresh();
      } else {
        message.error(response.message || '取消角色分配失败');
      }
    } catch (error) {
      message.error('取消角色分配失败');
    }
  };

  // 软删除用户
  const handleSoftDelete = async (user: User) => {
    try {
      const response = await roleAssignmentService.softDeleteUser(user.id);
      if (response.success) {
        message.success('用户已停用');
        handleRefresh();
      } else {
        message.error(response.message || '停用用户失败');
      }
    } catch (error) {
      message.error('停用用户失败');
    }
  };

  // 恢复用户
  const handleRestoreUser = async (user: User) => {
    try {
      const response = await roleAssignmentService.restoreUser(user.id);
      if (response.success) {
        message.success('用户已恢复');
        handleRefresh();
      } else {
        message.error(response.message || '恢复用户失败');
      }
    } catch (error) {
      message.error('恢复用户失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (text: string, record: User) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.uid_number && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              UID: {record.uid_number}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 120
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
      filters: roleAssignmentService.getUserTypeOptions().map(option => ({
        text: option.label,
        value: option.value
      })),
      onFilter: (value: any, record: User) => record.user_type === value
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
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_: any, record: User) => (
        <Space direction="vertical" size={0}>
          <Badge 
            status={record.is_active ? 'success' : 'error'} 
            text={record.is_active ? '活跃' : '已停用'} 
          />
          {record.is_deleted_from_ldap && (
            <Tag color="orange" icon={<ExclamationCircleOutlined />} style={{ fontSize: '11px' }}>
              LDAP已删除
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '同步时间',
      dataIndex: 'last_sync_at',
      key: 'last_sync_at',
      width: 140,
      render: (text: string) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {new Date(text).toLocaleString()}
        </Text>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: User) => (
        <Space size="small" wrap>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewUser(record)}
            />
          </Tooltip>
          
          {record.user_type === 'unassigned' ? (
            <Tooltip title="分配角色">
              <Button
                type="text"
                icon={<UserSwitchOutlined />}
                onClick={() => handleAssignRole(record)}
              />
            </Tooltip>
          ) : (
            <Tooltip title="更改角色">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleChangeRole(record)}
              />
            </Tooltip>
          )}
          
          {record.user_type !== 'unassigned' && (
            <Popconfirm
              title="确定要取消角色分配吗？"
              onConfirm={() => handleUnassignRole(record)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="取消角色">
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
          
          {record.is_active ? (
            <Popconfirm
              title="确定要停用此用户吗？"
              onConfirm={() => handleSoftDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="停用用户">
                <Button
                  type="text"
                  danger
                  size="small"
                >
                  停用
                </Button>
              </Tooltip>
            </Popconfirm>
          ) : (
            <Tooltip title="恢复用户">
              <Button
                type="text"
                size="small"
                onClick={() => handleRestoreUser(record)}
              >
                恢复
              </Button>
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card>
        {/* 过滤器和操作栏 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Search
              placeholder="搜索用户名、姓名或邮箱"
              allowClear
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="角色类型"
              allowClear
              onChange={(value) => handleFilterChange('user_type', value)}
              style={{ width: '100%' }}
            >
              {roleAssignmentService.getUserTypeOptions().map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="用户状态"
              allowClear
              onChange={(value) => handleFilterChange('is_active', value)}
              style={{ width: '100%' }}
            >
              <Option value={true}>活跃</Option>
              <Option value={false}>已停用</Option>
            </Select>
          </Col>
          <Col span={8}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<UserSwitchOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                导入用户
              </Button>
              <Button
                icon={<FilterOutlined />}
                onClick={() => {
                  setFilters({});
                  loadUsers(1, {});
                }}
              >
                清除过滤
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 统计信息 */}
        <Alert
          message={
            <Space>
              <Text>共 {total} 个用户</Text>
              <Text type="secondary">|</Text>
              <Text>未分配角色: {users.filter(u => u.user_type === 'unassigned').length}</Text>
              <Text type="secondary">|</Text>
              <Text>PI用户: {users.filter(u => u.user_type === 'pi').length}</Text>
              <Text type="secondary">|</Text>
              <Text>学生: {users.filter(u => u.user_type === 'student').length}</Text>
              <Text type="secondary">|</Text>
              <Text type="warning">已从LDAP删除: {users.filter(u => u.is_deleted_from_ldap).length}</Text>
            </Space>
          }
          type="info"
          style={{ marginBottom: 16 }}
        />

        {/* 用户表格 */}
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          onChange={(paginationInfo) => handleTableChange(paginationInfo.current || 1, paginationInfo.pageSize)}
          scroll={{ x: 1200 }}
          size="small"
        />
      </Card>

      {/* 用户详情抽屉 */}
      <Drawer
        title="用户详情"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={600}
      >
        {selectedUser && (
          <div>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="用户名">{selectedUser.username}</Descriptions.Item>
              <Descriptions.Item label="姓名">{selectedUser.full_name}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{selectedUser.email}</Descriptions.Item>
              <Descriptions.Item label="电话">{selectedUser.phone || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="角色">
                <Tag color={roleAssignmentService.getUserTypeColor(selectedUser.user_type)}>
                  {roleAssignmentService.getUserTypeText(selectedUser.user_type)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="LDAP DN">{selectedUser.ldap_dn || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="UID">{selectedUser.uid_number || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="GID">{selectedUser.gid_number || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="主目录">{selectedUser.home_directory || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="登录Shell">{selectedUser.login_shell || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Space>
                  <Badge 
                    status={selectedUser.is_active ? 'success' : 'error'} 
                    text={selectedUser.is_active ? '活跃' : '已停用'} 
                  />
                  {selectedUser.is_deleted_from_ldap && (
                    <Tag color="orange">已从LDAP删除</Tag>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : '未知'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {selectedUser.updated_at ? new Date(selectedUser.updated_at).toLocaleString() : '未知'}
              </Descriptions.Item>
              <Descriptions.Item label="最后同步时间">
                {selectedUser.last_sync_at ? new Date(selectedUser.last_sync_at).toLocaleString() : '未知'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 角色分配模态框 */}
      <RoleAssignmentModal
        visible={roleModalVisible}
        user={selectedUser}
        mode={roleModalMode}
        onCancel={() => setRoleModalVisible(false)}
        onSuccess={handleRefresh}
      />

      {/* 用户导入模态框 */}
      <UserImportModal
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
};

export default EnhancedUserList;