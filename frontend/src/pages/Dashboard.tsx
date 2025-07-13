import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Space, Button } from 'antd';
import { UserOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { requestService } from '../services/request';
import { studentService } from '../services/student';
import { RequestStats, Student, Request } from '../types';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<RequestStats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 加载申请统计
      const statsResponse = await requestService.getRequestStats();
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      // 加载最近的学生
      if (user?.user_type === 'pi') {
        const studentsResponse = await studentService.getMyStudents(1, 5);
        if (studentsResponse.success && studentsResponse.data) {
          setRecentStudents(studentsResponse.data.items);
        }
      }

      // 加载最近的申请
      const requestsResponse = user?.user_type === 'pi' 
        ? await requestService.getMyRequests(1, 5)
        : await requestService.getAllRequests(1, 5);
      
      if (requestsResponse.success && requestsResponse.data) {
        setRecentRequests(requestsResponse.data.items);
      }
    } catch (error) {
      console.error('加载仪表板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 学生表格列定义
  const studentColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '中文姓名',
      dataIndex: 'chinese_name',
      key: 'chinese_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={studentService.getStatusColor(status)}>
          {studentService.getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => new Date(time).toLocaleDateString(),
    },
  ];

  // 申请表格列定义
  const requestColumns = [
    {
      title: '类型',
      dataIndex: 'request_type',
      key: 'request_type',
      render: (type: string) => (
        <Tag color={requestService.getTypeColor(type)}>
          {requestService.getTypeText(type)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={requestService.getStatusColor(status)}>
          {requestService.getStatusText(status)}
        </Tag>
      ),
    },
    ...(false ? [{ // 暂时禁用admin列
      title: '课题组长',
      dataIndex: 'pi_username',
      key: 'pi_username',
    }] : []),
    {
      title: '申请时间',
      dataIndex: 'requested_at',
      key: 'requested_at',
      render: (time: string) => requestService.formatTime(time),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>
        欢迎回来，{user?.full_name || user?.username}
        {/* 暂时移除admin标签 */}
      </h1>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待审核申请"
              value={stats.pending}
              prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已批准申请"
              value={stats.approved}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已拒绝申请"
              value={stats.rejected}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总申请数"
              value={stats.total}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 最近的学生 - 仅课题组长显示 */}
        {user?.user_type === 'pi' && (
          <Col xs={24} lg={12}>
            <Card
              title="最近的学生"
              extra={
                <Button type="link" onClick={() => navigate('/students')}>
                  查看全部
                </Button>
              }
            >
              <Table
                columns={studentColumns}
                dataSource={recentStudents}
                pagination={false}
                size="small"
                rowKey="id"
                loading={loading}
              />
            </Card>
          </Col>
        )}

        {/* 最近的申请 */}
        <Col xs={24} lg={user?.user_type === 'pi' ? 12 : 24}>
          <Card
            title="最近的申请"
            extra={
              <Button 
                type="link" 
                onClick={() => navigate('/requests')}
              >
                查看全部
              </Button>
            }
          >
            <Table
              columns={requestColumns}
              dataSource={recentRequests}
              pagination={false}
              size="small"
              rowKey="id"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 - 仅课题组长显示 */}
      {user?.user_type === 'pi' && (
        <Card title="快速操作" style={{ marginTop: 16 }}>
          <Space>
            <Button 
              type="primary" 
              icon={<UserOutlined />}
              onClick={() => navigate('/students/create')}
            >
              创建学生账号
            </Button>
            <Button 
              icon={<FileTextOutlined />}
              onClick={() => navigate('/requests')}
            >
              查看申请记录
            </Button>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;