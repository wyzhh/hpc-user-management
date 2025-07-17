import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Space, Tag, Descriptions, message, Spin } from 'antd';
import { CheckOutlined, CloseOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Request } from '../../types';
import { requestService } from '../../services/request';

const { TextArea } = Input;

interface RequestReviewModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  request: Request | null;
  isAdmin?: boolean; // 是否为管理员
}

const RequestReviewModal: React.FC<RequestReviewModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  request,
  isAdmin = false
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // 加载申请详情
  const loadRequestDetails = async (requestId: number) => {
    setDetailsLoading(true);
    try {
      const response = await requestService.getRequestById(requestId);
      if (response.success && response.data) {
        // 详情数据加载完成，这里可以处理详情数据
        console.log('Request details loaded:', response.data);
      }
    } catch (error) {
      console.error('Load request details error:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  // 重置表单
  useEffect(() => {
    if (visible && request) {
      form.resetFields();
      setReviewAction(null);
      loadRequestDetails(request.id);
    }
  }, [visible, request, form]);

  // 处理审核
  const handleReview = async (action: 'approve' | 'reject') => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      let response;
      if (action === 'approve') {
        response = await requestService.approveRequest(request!.id, values.reason);
      } else {
        response = await requestService.rejectRequest(request!.id, values.reason);
      }
      
      if (response.success) {
        message.success(`申请已${action === 'approve' ? '批准' : '拒绝'}`);
        onSuccess();
      } else {
        message.error(`${action === 'approve' ? '批准' : '拒绝'}申请失败: ` + response.message);
      }
    } catch (error) {
      console.error('Review request error:', error);
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化学生数据
  const formatStudentData = (data: any) => {
    if (!data) return null;
    try {
      const studentData = typeof data === 'string' ? JSON.parse(data) : data;
      return (
        <Descriptions column={2} size="small">
          <Descriptions.Item label="用户名">{studentData.username}</Descriptions.Item>
          <Descriptions.Item label="中文姓名">{studentData.chinese_name}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{studentData.email}</Descriptions.Item>
          <Descriptions.Item label="手机号">{studentData.phone || '-'}</Descriptions.Item>
        </Descriptions>
      );
    } catch {
      return <span style={{ color: '#999' }}>数据解析失败</span>;
    }
  };


  if (!request) return null;


  return (
    <Modal
      title={
        <Space>
          <span>申请审核</span>
          <Tag color={requestService.getTypeColor(request.request_type)}>
            {requestService.getTypeText(request.request_type)}
          </Tag>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={request.status === 'pending' && isAdmin ? [
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button 
          key="reject" 
          danger 
          icon={<CloseOutlined />}
          loading={loading && reviewAction === 'reject'}
          onClick={() => {
            setReviewAction('reject');
            handleReview('reject');
          }}
        >
          拒绝
        </Button>,
        <Button 
          key="approve" 
          type="primary" 
          icon={<CheckOutlined />}
          loading={loading && reviewAction === 'approve'}
          onClick={() => {
            setReviewAction('approve');
            handleReview('approve');
          }}
        >
          批准
        </Button>,
      ] : [
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
      ]}
      width={700}
      destroyOnClose
    >
      <Spin spinning={detailsLoading}>
        <div style={{ marginBottom: 20 }}>
          {/* 申请基本信息 */}
          <Descriptions title="申请信息" column={2} bordered size="small">
            <Descriptions.Item label="申请编码">{request.id}</Descriptions.Item>
            <Descriptions.Item label="申请类型">
              <Tag color={requestService.getTypeColor(request.request_type)}>
                {requestService.getTypeText(request.request_type)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="申请状态">
              <Tag color={requestService.getStatusColor(request.status)}>
                {requestService.getStatusText(request.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="申请时间">{requestService.formatTime(request.requested_at)}</Descriptions.Item>
            <Descriptions.Item label="课题组长">
              <Space>
                <UserOutlined />
                {request.pi_name} (@{request.pi_username})
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* 组用户信息 */}
        <div style={{ marginBottom: 20 }}>
          <h4>组用户信息</h4>
          {request.request_type === 'create' ? (
            formatStudentData(request.student_data)
          ) : request.request_type === 'delete' ? (
            request.student_username ? (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="用户名">{request.student_username}</Descriptions.Item>
                <Descriptions.Item label="中文姓名">{request.student_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{request.student_email || '-'}</Descriptions.Item>
                <Descriptions.Item label="操作">删除此用户</Descriptions.Item>
              </Descriptions>
            ) : (
              <span style={{ color: '#999' }}>学生信息不可用</span>
            )
          ) : (
            <span style={{ color: '#999' }}>无学生信息</span>
          )}
        </div>

        {/* 审核表单 */}
        {request.status === 'pending' && isAdmin && (
          <Form
            form={form}
            layout="vertical"
            style={{ marginTop: 20 }}
          >
            <Form.Item
              name="reason"
              label="审核意见"
              rules={[
                { max: 500, message: '审核意见不能超过500个字符' }
              ]}
            >
              <TextArea
                placeholder="请输入审核意见（可选）"
                rows={4}
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Form>
        )}

        {/* 审核历史 */}
        {request.reviewed_at && (
          <div style={{ marginTop: 20 }}>
            <h4>审核信息</h4>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="审核时间">
                <Space>
                  <ClockCircleOutlined />
                  {requestService.formatTime(request.reviewed_at)}
                </Space>
              </Descriptions.Item>
              {request.admin_id && (
                <Descriptions.Item label="审核管理员">管理员ID: {request.admin_id}</Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default RequestReviewModal;