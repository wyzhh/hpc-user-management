import React, { useState, useEffect } from 'react';
import { Card, Tabs, Space, Statistic, Row, Col, message } from 'antd';
import { UserOutlined, CheckCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons';
import StudentList from '../components/student/StudentList';
import StudentForm from '../components/student/StudentForm';
import { Student } from '../types';
import { studentService } from '../services/student';

const { TabPane } = Tabs;

const StudentManagement: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    deleted: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  // 加载学生统计数据
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const response = await studentService.getMyStudentStats();
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        message.error('加载统计数据失败: ' + response.message);
      }
    } catch (error) {
      message.error('加载统计数据失败');
      console.error('Load stats error:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 初始加载统计数据
  useEffect(() => {
    loadStats();
  }, []);

  // 当refreshKey改变时，重新加载统计数据
  useEffect(() => {
    if (refreshKey > 0) {
      loadStats();
    }
  }, [refreshKey]);

  // 打开创建学生表单
  const handleCreateStudent = () => {
    setSelectedStudent(null);
    setFormMode('create');
    setFormVisible(true);
  };

  // 打开编辑学生表单
  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student);
    setFormMode('edit');
    setFormVisible(true);
  };

  // 表单成功回调
  const handleFormSuccess = () => {
    setFormVisible(false);
    setSelectedStudent(null);
    // 触发学生列表刷新
    setRefreshKey(prev => prev + 1);
  };

  // 关闭表单
  const handleFormCancel = () => {
    setFormVisible(false);
    setSelectedStudent(null);
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>学生管理</h1>
        <p style={{ margin: '8px 0 0 0', color: '#666' }}>
          管理您的学生账号，包括创建申请、查看状态和删除申请
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="总学生数"
              value={stats.total}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="活跃学生"
              value={stats.active}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="待审核"
              value={stats.pending}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="已删除"
              value={stats.deleted}
              prefix={<StopOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 主要内容区域 */}
      <Card>
        <Tabs defaultActiveKey="list" size="large">
          <TabPane 
            tab={
              <Space>
                <UserOutlined />
                学生列表
              </Space>
            } 
            key="list"
          >
            <StudentList
              key={refreshKey}
              onCreateStudent={handleCreateStudent}
              onEditStudent={handleEditStudent}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 学生表单弹窗 */}
      <StudentForm
        visible={formVisible}
        mode={formMode}
        student={selectedStudent}
        onSuccess={handleFormSuccess}
        onCancel={handleFormCancel}
      />
    </div>
  );
};

export default StudentManagement;