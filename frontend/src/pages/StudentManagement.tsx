import React, { useState } from 'react';
import { Card, Tabs, Space, Statistic, Row, Col } from 'antd';
import { UserOutlined, CheckCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons';
import StudentList from '../components/student/StudentList';
import StudentForm from '../components/student/StudentForm';
import { Student } from '../types';

const { TabPane } = Tabs;

const StudentManagement: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
          <Card>
            <Statistic
              title="总学生数"
              value={0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃学生"
              value={0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核"
              value={0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已删除"
              value={0}
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