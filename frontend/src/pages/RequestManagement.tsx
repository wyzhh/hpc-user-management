import React, { useState, useEffect } from 'react';
import { Card, Tabs, Space, Statistic, Row, Col } from 'antd';
import { FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined, StopOutlined } from '@ant-design/icons';
import RequestList from '../components/request/RequestList';
import RequestReviewModal from '../components/request/RequestReviewModal';
import { Request, RequestStats } from '../types';
import { requestService } from '../services/request';
import { useAuth } from '../contexts/AuthContext';

const { TabPane } = Tabs;

const RequestManagement: React.FC = () => {
  const { user } = useAuth();
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<RequestStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const isAdmin = false; // 暂时禁用admin功能

  // 加载统计数据
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const response = await requestService.getRequestStats();
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

  // 查看申请详情
  const handleViewRequest = (request: Request) => {
    setSelectedRequest(request);
    setReviewModalVisible(true);
  };

  // 申请审核成功回调
  const handleReviewSuccess = () => {
    setReviewModalVisible(false);
    setSelectedRequest(null);
    // 触发列表刷新
    setRefreshKey(prev => prev + 1);
    // 重新加载统计数据
    loadStats();
  };

  // 关闭审核模态框
  const handleCloseReviewModal = () => {
    setReviewModalVisible(false);
    setSelectedRequest(null);
  };

  // 申请审核回调
  const handleReviewRequest = (request: Request, action: 'approve' | 'reject') => {
    // 重新加载统计数据
    loadStats();
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
          {isAdmin ? '申请审核管理' : '我的申请记录'}
        </h1>
        <p style={{ margin: '8px 0 0 0', color: '#666' }}>
          {isAdmin 
            ? '审核PI用户提交的学生账号创建和删除申请' 
            : '查看您提交的学生账号申请状态和历史记录'
          }
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="总申请数"
              value={stats?.total || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="待审核"
              value={stats?.pending || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="已批准"
              value={stats?.approved || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="已拒绝"
              value={stats?.rejected || 0}
              prefix={<StopOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 主要内容区域 */}
      <Card>
        <Tabs defaultActiveKey="all" size="large">
          <TabPane 
            tab={
              <Space>
                <FileTextOutlined />
                {isAdmin ? '全部申请' : '我的申请'}
              </Space>
            } 
            key="all"
          >
            <RequestList
              key={refreshKey}
              isAdmin={isAdmin}
              onViewRequest={handleViewRequest}
              onReviewRequest={handleReviewRequest}
            />
          </TabPane>
          
          {isAdmin && (
            <TabPane 
              tab={
                <Space>
                  <ClockCircleOutlined />
                  待审核申请
                  {stats?.pending ? <span style={{ 
                    backgroundColor: '#faad14', 
                    color: 'white', 
                    borderRadius: '10px',
                    padding: '0 6px',
                    fontSize: '12px',
                    marginLeft: '4px'
                  }}>{stats.pending}</span> : null}
                </Space>
              } 
              key="pending"
            >
              <RequestList
                key={`pending-${refreshKey}`}
                isAdmin={true}
                onViewRequest={handleViewRequest}
                onReviewRequest={handleReviewRequest}
              />
            </TabPane>
          )}
        </Tabs>
      </Card>

      {/* 申请审核模态框 */}
      <RequestReviewModal
        visible={reviewModalVisible}
        request={selectedRequest}
        onSuccess={handleReviewSuccess}
        onCancel={handleCloseReviewModal}
      />
    </div>
  );
};

export default RequestManagement;