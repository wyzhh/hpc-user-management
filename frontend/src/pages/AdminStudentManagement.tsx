import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  message,
  Modal,
  Select,
  Tag,
  Popconfirm,
} from 'antd';
import {
  UsergroupAddOutlined,
  UserDeleteOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { studentManagementService } from '../services/studentManagement';

const { Title } = Typography;
const { Option } = Select;

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
}

interface PI {
  id: number;
  username: string;
  full_name: string;
  email: string;
  department?: string;
  students: Student[];
}

interface Student {
  id: number;
  user_id: number;
  pi_id: number;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  created_at: string;
  pi_username: string;
  pi_full_name: string;
}

const StudentManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [pisWithStudents, setPisWithStudents] = useState<PI[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedPI, setSelectedPI] = useState<number | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [stats, setStats] = useState({
    totalPIs: 0,
    totalStudents: 0,
    unassignedUsers: 0,
  });

  // 获取PI和组用户列表
  const fetchPIsWithStudents = async () => {
    setLoading(true);
    try {
      const response = await studentManagementService.getPIsWithStudents();
      console.log('PI列表响应:', response);
      if (response.success) {
        setPisWithStudents(response.data.pis);
        console.log('PI数量:', response.data.pis.length);
        setStats({
          totalPIs: response.data.pis.length,
          totalStudents: response.data.pis.reduce((sum, pi) => sum + pi.students.length, 0),
          unassignedUsers: response.data.total_unassigned || 0,
        });
      } else {
        message.error(response.message || '获取PI和组用户列表失败');
      }
    } catch (error) {
      console.error('获取PI和组用户列表错误:', error);
      message.error('获取PI和组用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取可分配的用户列表
  const fetchAvailableUsers = async () => {
    try {
      const response = await studentManagementService.getUsersForStudentAssignment();
      if (response.success) {
        setAvailableUsers(response.data.users);
      }
    } catch (error) {
      message.error('获取可分配用户列表失败');
    }
  };

  useEffect(() => {
    fetchPIsWithStudents();
  }, []);

  // 打开分配模态框
  const handleAssignClick = () => {
    setAssignModalVisible(true);
    fetchAvailableUsers();
  };

  // 分配组用户给PI
  const handleAssignStudents = async () => {
    if (!selectedPI || selectedUsers.length === 0) {
      message.warning('请选择PI和要分配的用户');
      return;
    }

    setLoading(true);
    try {
      for (const userId of selectedUsers) {
        await studentManagementService.assignStudentToPI(userId, selectedPI);
      }
      message.success(`成功分配 ${selectedUsers.length} 个组用户`);
      setAssignModalVisible(false);
      setSelectedPI(null);
      setSelectedUsers([]);
      fetchPIsWithStudents();
    } catch (error) {
      message.error('分配组用户失败');
    } finally {
      setLoading(false);
    }
  };

  // 移除组用户
  const handleRemoveStudent = async (student: Student) => {
    setLoading(true);
    try {
      await studentManagementService.removeStudentFromPI(student.user_id);
      message.success('移除组用户成功');
      fetchPIsWithStudents();
    } catch (error) {
      message.error('移除组用户失败');
    } finally {
      setLoading(false);
    }
  };

  // PI表格列定义
  const piColumns = [
    {
      title: '课题组长名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '课题组长姓名',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '院系',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: '组用户数量',
      key: 'student_count',
      render: (_: any, record: PI) => (
        <Tag color="blue">{record.students.length}</Tag>
      ),
    },
  ];

  // 组用户表格列定义
  const studentColumns = [
    {
      title: '组用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '组用户姓名',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '分配时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Student) => (
        <Popconfirm
          title="确定要移除这个组用户吗？"
          onConfirm={() => handleRemoveStudent(record)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<UserDeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>组用户管理</Title>
        <p>管理PI的组用户分配，为PI分配组用户或移除组用户</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="PI总数"
              value={stats.totalPIs}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="组用户总数"
              value={stats.totalStudents}
              prefix={<UsergroupAddOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="未分配用户"
              value={stats.unassignedUsers}
              prefix={<UserDeleteOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作按钮 */}
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<UsergroupAddOutlined />}
          onClick={handleAssignClick}
        >
          分配组用户
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchPIsWithStudents}
          loading={loading}
        >
          刷新
        </Button>
      </Space>

      {/* PI和组用户列表 */}
      <Card title="PI和组用户列表">
        <Table
          columns={piColumns}
          dataSource={pisWithStudents}
          rowKey="id"
          loading={loading}
          expandable={{
            expandedRowRender: (record: PI) => (
              <Table
                columns={studentColumns}
                dataSource={record.students}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: '该PI暂无组用户' }}
              />
            ),
            rowExpandable: (record: PI) => record.students.length > 0,
          }}
        />
      </Card>

      {/* 分配组用户模态框 */}
      <Modal
        title="分配组用户给PI"
        open={assignModalVisible}
        onOk={handleAssignStudents}
        onCancel={() => {
          setAssignModalVisible(false);
          setSelectedPI(null);
          setSelectedUsers([]);
        }}
        confirmLoading={loading}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label>选择PI：</label>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="请选择要分配组用户的PI"
              value={selectedPI}
              onChange={setSelectedPI}
            >
              {pisWithStudents.length === 0 ? (
                <Option disabled value="">暂无可用PI，请先在PI管理中创建PI</Option>
              ) : (
                pisWithStudents.map(pi => (
                  <Option key={pi.id} value={pi.id}>
                    {pi.full_name} ({pi.username})
                  </Option>
                ))
              )}
            </Select>
          </div>

          <div>
            <label>选择组用户：</label>
            <Select
              mode="multiple"
              style={{ width: '100%', marginTop: 8 }}
              placeholder="请选择要分配的用户作为组用户"
              value={selectedUsers}
              onChange={setSelectedUsers}
              showSearch
              filterOption={(input, option) => {
                const label = option?.label || '';
                return String(label).toLowerCase().includes(input.toLowerCase());
              }}
            >
              {availableUsers.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.full_name} ({user.username})
                </Option>
              ))}
            </Select>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default StudentManagement;