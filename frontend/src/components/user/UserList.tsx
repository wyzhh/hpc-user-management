import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, message, Switch, Input, Select, Card, Badge, Tooltip, Popconfirm, Modal, Descriptions } from 'antd';
import { EditOutlined, PlusOutlined, SyncOutlined, KeyOutlined, EyeOutlined, ThunderboltOutlined, DeleteOutlined } from '@ant-design/icons';
import { PIUser, AdminUser, StudentUser, userService } from '../../services/user';

const { Search } = Input;
const { Option } = Select;

interface UserListProps {
  userType: 'pi' | 'admin' | 'student' | 'all_users';
  onCreateUser?: () => void;
  onEditUser?: (user: PIUser | AdminUser | StudentUser) => void;
  onViewUser?: (user: PIUser | AdminUser | StudentUser) => void;
  onResetPassword?: (user: AdminUser) => void;
  onDeleteUser?: (user: StudentUser) => void;
  onDeleteUserFromLDAP?: (user: PIUser | AdminUser | StudentUser) => void;
}

const UserList: React.FC<UserListProps> = ({
  userType,
  onCreateUser,
  onEditUser,
  onViewUser,
  onResetPassword,
  onDeleteUser,
  onDeleteUserFromLDAP
}) => {
  const [users, setUsers] = useState<(PIUser | AdminUser | StudentUser)[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [incrementalSyncLoading, setIncrementalSyncLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [syncResultModalVisible, setSyncResultModalVisible] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // 加载用户列表
  const loadUsers = async (page = 1, pageSize = 10, statusOrActive?: boolean | string, search?: string) => {
    setLoading(true);
    try {
      let response;
      if (userType === 'pi') {
        response = await userService.getPIUsers(page, pageSize, statusOrActive as boolean, search);
      } else if (userType === 'admin') {
        response = await userService.getAdminUsers(page, pageSize, statusOrActive as boolean, search);
      } else if (userType === 'all_users') {
        response = await userService.getAllUsers(page, pageSize, statusOrActive as boolean, search);
      } else {
        // 学生用户
        response = await userService.getStudentUsers(page, pageSize, statusOrActive as string, search);
      }
        
      if (response.success && response.data) {
        setUsers(response.data.items);
        setPagination({
          current: page,
          pageSize,
          total: response.data.total,
        });
      } else {
        message.error('加载用户列表失败: ' + response.message);
      }
    } catch (error) {
      message.error('加载用户列表失败');
      console.error('Load users error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadUsers();
  }, [userType]);

  // 切换用户状态
  const handleToggleStatus = async (user: PIUser | AdminUser | StudentUser, checked: boolean | string) => {
    try {
      let response;
      if (userType === 'pi') {
        response = await userService.togglePIUserStatus(user.id, checked as boolean);
      } else if (userType === 'admin') {
        response = await userService.toggleAdminUserStatus(user.id, checked as boolean);
      } else {
        // 学生用户状态切换
        const newStatus = checked ? 'active' : 'deleted';
        response = await userService.updateStudentStatus(user.id, newStatus as 'pending' | 'active' | 'deleted');
      }
        
      if (response.success) {
        message.success(`用户状态已更新`);
        loadUsers(pagination.current, pagination.pageSize, undefined, searchText);
      } else {
        message.error('更新用户状态失败: ' + response.message);
      }
    } catch (error) {
      message.error('更新用户状态失败');
      console.error('Toggle user status error:', error);
    }
  };

  // 删除学生用户
  const handleDeleteStudent = async (student: StudentUser) => {
    try {
      const response = await userService.deleteStudentUser(student.id);
      if (response.success) {
        message.success('学生账号删除成功');
        loadUsers(pagination.current, pagination.pageSize, undefined, searchText);
      } else {
        message.error('删除学生账号失败: ' + response.message);
      }
    } catch (error) {
      message.error('删除学生账号失败');
      console.error('Delete student error:', error);
    }
  };

  // 完全同步LDAP用户
  const handleSyncLDAP = async () => {
    setSyncLoading(true);
    try {
      const response = await userService.syncLDAPUsers();
      if (response.success && response.data) {
        if (response.data.sync_result) {
          // 显示详细同步结果
          setSyncResult(response.data.sync_result);
          setSyncResultModalVisible(true);
        } else {
          // 兼容旧格式
          message.success(`同步完成：新增 ${response.data.new_pis} 个，更新 ${response.data.updated_pis} 个PI用户`);
        }
        loadUsers(pagination.current, pagination.pageSize, undefined, searchText);
      } else {
        message.error('完全同步LDAP用户失败: ' + response.message);
      }
    } catch (error) {
      message.error('完全同步LDAP用户失败');
      console.error('Full sync LDAP users error:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  // 增量同步LDAP用户
  const handleIncrementalSyncLDAP = async () => {
    setIncrementalSyncLoading(true);
    try {
      const response = await userService.incrementalSyncLDAPUsers();
      if (response.success && response.data) {
        setSyncResult(response.data.sync_result);
        setSyncResultModalVisible(true);
        loadUsers(pagination.current, pagination.pageSize, undefined, searchText);
      } else {
        message.error('增量同步LDAP用户失败: ' + response.message);
      }
    } catch (error) {
      message.error('增量同步LDAP用户失败');
      console.error('Incremental sync LDAP users error:', error);
    } finally {
      setIncrementalSyncLoading(false);
    }
  };


  // 搜索功能
  const handleSearch = (value: string) => {
    setSearchText(value);
    loadUsers(1, pagination.pageSize, undefined, value);
  };

  // PI用户表格列
  const piColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
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
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: (department: string) => department || '-',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (phone: string) => phone || '-',
    },
    {
      title: '学生数量',
      dataIndex: 'student_count',
      key: 'student_count',
      width: 100,
      render: (count: number) => (
        <Badge count={count || 0} style={{ backgroundColor: '#52c41a' }} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean, record: PIUser) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleStatus(record, checked)}
          checkedChildren="活跃"
          unCheckedChildren="停用"
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => (
        <Tooltip title={userService.formatTime(date)}>
          <span>{new Date(date).toLocaleDateString()}</span>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: PIUser) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewUser?.(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEditUser?.(record)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  // 管理员表格列
  const adminColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
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
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={userService.getRoleColor(role)}>
          {userService.getRoleText(role)}
        </Tag>
      ),
    },
    {
      title: '认证方式',
      key: 'auth_type',
      width: 100,
      render: (_: any, record: AdminUser) => (
        <Tag color={record.ldap_dn ? 'blue' : 'green'}>
          {record.ldap_dn ? 'LDAP' : '本地'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean, record: AdminUser) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleStatus(record, checked)}
          checkedChildren="活跃"
          unCheckedChildren="停用"
        />
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login',
      key: 'last_login',
      width: 150,
      render: (date: string) => (
        date ? (
          <Tooltip title={userService.formatTime(date)}>
            <span>{new Date(date).toLocaleDateString()}</span>
          </Tooltip>
        ) : '-'
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: AdminUser) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewUser?.(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEditUser?.(record)}
          >
            编辑
          </Button>
          {!record.ldap_dn && (
            <Popconfirm
              title="确定要重置这个管理员的密码吗？"
              description="重置后将生成新的随机密码"
              onConfirm={() => onResetPassword?.(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                icon={<KeyOutlined />}
              >
                重置密码
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 所有用户表格列
  const allUsersColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: 'UID',
      dataIndex: 'uid_number',
      key: 'uid_number',
      width: 100,
    },
    {
      title: 'GID',
      dataIndex: 'gid_number',
      key: 'gid_number',
      width: 100,
    },
    {
      title: '家目录',
      dataIndex: 'home_directory',
      key: 'home_directory',
      width: 200,
      render: (path: string) => path || '-',
    },
    {
      title: 'LDAP状态',
      dataIndex: 'is_deleted_from_ldap',
      key: 'is_deleted_from_ldap',
      width: 120,
      render: (isDeleted: boolean) => (
        <Tag color={isDeleted ? 'red' : 'green'}>
          {isDeleted ? '已从LDAP删除' : 'LDAP中存在'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => (
        <Tooltip title={userService.formatTime(date)}>
          <span>{new Date(date).toLocaleDateString()}</span>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewUser?.(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEditUser?.(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="删除用户"
            description="确定要从LDAP和数据库中永久删除此用户吗？此操作不可恢复！"
            onConfirm={() => onDeleteUserFromLDAP?.(record)}
            okText="确定删除"
            cancelText="取消"
            okType="danger"
          >
            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 学生表格列
  const studentColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '中文姓名',
      dataIndex: 'chinese_name',
      key: 'chinese_name',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (phone: string) => phone || '-',
    },
    {
      title: '导师',
      key: 'pi_info',
      width: 150,
      render: (_: any, record: StudentUser) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.pi_name || '-'}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.pi_username || '-'}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: StudentUser) => {
        if (status === 'pending') {
          return <Tag color="orange">待审核</Tag>;
        } else if (status === 'active') {
          return (
            <Switch
              checked={true}
              onChange={(checked) => handleToggleStatus(record, checked)}
              checkedChildren="活跃"
              unCheckedChildren="停用"
            />
          );
        } else {
          return <Tag color="red">已删除</Tag>;
        }
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => (
        <Tooltip title={userService.formatTime(date)}>
          <span>{new Date(date).toLocaleDateString()}</span>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: StudentUser) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewUser?.(record)}
          >
            查看
          </Button>
          {record.status !== 'deleted' && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEditUser?.(record)}
            >
              编辑
            </Button>
          )}
          {record.status === 'active' && (
            <Popconfirm
              title="确定要删除这个学生账号吗？"
              description="删除后将无法恢复，请谨慎操作"
              onConfirm={() => handleDeleteStudent(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];


  return (
    <Card>
      {/* 搜索和过滤区域 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Search
            placeholder={`搜索${
              userType === 'pi' ? 'PI用户' : 
              userType === 'admin' ? '管理员' : 
              userType === 'all_users' ? '用户' : '学生'
            }名称、邮箱`}
            allowClear
            style={{ width: 250 }}
            onSearch={handleSearch}
            onChange={(e) => !e.target.value && handleSearch('')}
          />
        </Space>
        <Space>
          {userType === 'pi' && (
            <>
              <Button
                icon={<SyncOutlined />}
                loading={syncLoading}
                onClick={handleSyncLDAP}
              >
                完全同步LDAP
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                loading={incrementalSyncLoading}
                onClick={handleIncrementalSyncLDAP}
              >
                增量同步
              </Button>
            </>
          )}
          {userType === 'admin' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onCreateUser}
            >
              添加管理员
            </Button>
          )}
        </Space>
      </div>

      {/* 用户列表表格 */}
      {userType === 'pi' ? (
        <Table
          columns={piColumns}
          dataSource={users as PIUser[]}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              loadUsers(page, pageSize, undefined, searchText);
            },
          }}
          scroll={{ x: 1000 }}
        />
      ) : userType === 'admin' ? (
        <Table
          columns={adminColumns}
          dataSource={users as AdminUser[]}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              loadUsers(page, pageSize, undefined, searchText);
            },
          }}
          scroll={{ x: 1000 }}
        />
      ) : userType === 'all_users' ? (
        <Table
          columns={allUsersColumns}
          dataSource={users as any[]}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              loadUsers(page, pageSize, undefined, searchText);
            },
          }}
          scroll={{ x: 1000 }}
        />
      ) : (
        <Table
          columns={studentColumns}
          dataSource={users as StudentUser[]}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              loadUsers(page, pageSize, undefined, searchText);
            },
          }}
          scroll={{ x: 1000 }}
        />
      )}

      {/* 同步结果模态框 */}
      <Modal
        title="LDAP同步结果"
        open={syncResultModalVisible}
        onCancel={() => setSyncResultModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSyncResultModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {syncResult && (
          <div>
            <Descriptions title="PI用户同步结果" column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="总数">
                <Badge count={syncResult.pis.total} style={{ backgroundColor: '#1890ff' }} />
              </Descriptions.Item>
              <Descriptions.Item label="新创建">
                <Badge count={syncResult.pis.created} style={{ backgroundColor: '#52c41a' }} />
              </Descriptions.Item>
              <Descriptions.Item label="已更新">
                <Badge count={syncResult.pis.updated} style={{ backgroundColor: '#faad14' }} />
              </Descriptions.Item>
              <Descriptions.Item label="已停用">
                <Badge count={syncResult.pis.deactivated} style={{ backgroundColor: '#f5222d' }} />
              </Descriptions.Item>
            </Descriptions>

            <Descriptions title="学生用户同步结果" column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="总数">
                <Badge count={syncResult.students.total} style={{ backgroundColor: '#1890ff' }} />
              </Descriptions.Item>
              <Descriptions.Item label="新创建">
                <Badge count={syncResult.students.created} style={{ backgroundColor: '#52c41a' }} />
              </Descriptions.Item>
              <Descriptions.Item label="已更新">
                <Badge count={syncResult.students.updated} style={{ backgroundColor: '#faad14' }} />
              </Descriptions.Item>
              <Descriptions.Item label="已删除">
                <Badge count={syncResult.students.deleted} style={{ backgroundColor: '#f5222d' }} />
              </Descriptions.Item>
            </Descriptions>

            {syncResult.errors && syncResult.errors.length > 0 && (
              <div>
                <h4 style={{ color: '#f5222d', marginBottom: 8 }}>同步错误：</h4>
                {syncResult.errors.map((error: string, index: number) => (
                  <div key={index} style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#fff2f0', 
                    border: '1px solid #ffccc7',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    color: '#a8071a'
                  }}>
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default UserList;