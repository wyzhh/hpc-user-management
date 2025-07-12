import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, message, Popconfirm, Input, Select, Card, Badge, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { Request } from '../../types';
import { requestService } from '../../services/request';

const { Search } = Input;
const { Option } = Select;

interface RequestListProps {
  onViewRequest?: (request: Request) => void;
  onReviewRequest?: (request: Request, action: 'approve' | 'reject') => void;
  isAdmin?: boolean;
}

const RequestList: React.FC<RequestListProps> = ({
  onViewRequest,
  onReviewRequest,
  isAdmin = false
}) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 加载申请列表
  const loadRequests = async (page = 1, pageSize = 10, status?: string, type?: string) => {
    setLoading(true);
    try {
      const response = isAdmin 
        ? await requestService.getAllRequests(page, pageSize, status)
        : await requestService.getMyRequests(page, pageSize, status, type);
        
      if (response.success && response.data) {
        setRequests(response.data.items);
        setPagination({
          current: page,
          pageSize,
          total: response.data.total,
        });
      } else {
        message.error('加载申请列表失败: ' + response.message);
      }
    } catch (error) {
      message.error('加载申请列表失败');
      console.error('Load requests error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadRequests();
  }, [isAdmin]);

  // 审核申请
  const handleApprove = async (request: Request) => {
    try {
      const response = await requestService.approveRequest(request.id);
      if (response.success) {
        message.success('申请已批准');
        loadRequests(pagination.current, pagination.pageSize, statusFilter);
        onReviewRequest?.(request, 'approve');
      } else {
        message.error('批准申请失败: ' + response.message);
      }
    } catch (error) {
      message.error('批准申请失败');
      console.error('Approve request error:', error);
    }
  };

  const handleReject = async (request: Request) => {
    try {
      const response = await requestService.rejectRequest(request.id, '管理员审核拒绝');
      if (response.success) {
        message.success('申请已拒绝');
        loadRequests(pagination.current, pagination.pageSize, statusFilter);
        onReviewRequest?.(request, 'reject');
      } else {
        message.error('拒绝申请失败: ' + response.message);
      }
    } catch (error) {
      message.error('拒绝申请失败');
      console.error('Reject request error:', error);
    }
  };

  // 状态过滤
  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    loadRequests(1, pagination.pageSize, value, typeFilter);
  };

  // 类型过滤
  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    loadRequests(1, pagination.pageSize, statusFilter, value);
  };

  // 搜索功能
  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  // 过滤申请数据
  const filteredRequests = requests.filter(request => {
    if (!searchText) return true;
    return (
      request.pi_username?.toLowerCase().includes(searchText.toLowerCase()) ||
      request.pi_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      request.reason?.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  // 获取学生数据显示
  const getStudentDataDisplay = (request: Request) => {
    if (request.request_type === 'create' && request.student_data) {
      try {
        const data = typeof request.student_data === 'string' 
          ? JSON.parse(request.student_data) 
          : request.student_data;
        return `${data.username} (${data.chinese_name})`;
      } catch {
        return '解析失败';
      }
    }
    return '-';
  };

  // 获取申请紧急度
  const getUrgencyBadge = (request: Request) => {
    const requestDate = new Date(request.requested_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff >= 7) {
      return <Badge status="error" text="紧急" />;
    } else if (daysDiff >= 3) {
      return <Badge status="warning" text="较急" />;
    }
    return <Badge status="success" text="正常" />;
  };

  // 表格列定义
  const columns = [
    {
      title: '申请ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '申请类型',
      dataIndex: 'request_type',
      key: 'request_type',
      width: 100,
      render: (type: string) => (
        <Tag color={requestService.getTypeColor(type)}>
          {requestService.getTypeText(type)}
        </Tag>
      ),
    },
    ...(isAdmin ? [{
      title: 'PI用户',
      key: 'pi_info',
      width: 150,
      render: (_: any, record: Request) => (
        <div>
          <div>{record.pi_name}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>@{record.pi_username}</div>
        </div>
      ),
    }] : []),
    {
      title: '学生信息',
      key: 'student_info',
      width: 150,
      render: (_: any, record: Request) => getStudentDataDisplay(record),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={requestService.getStatusColor(status)}>
          {requestService.getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '紧急度',
      key: 'urgency',
      width: 80,
      render: (_: any, record: Request) => getUrgencyBadge(record),
    },
    {
      title: '申请时间',
      dataIndex: 'requested_at',
      key: 'requested_at',
      width: 150,
      render: (date: string) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <span>{new Date(date).toLocaleDateString()}</span>
        </Tooltip>
      ),
    },
    {
      title: '申请理由',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (reason: string) => (
        <Tooltip title={reason}>
          <span>{reason}</span>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: isAdmin ? 180 : 100,
      render: (_: any, record: Request) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewRequest?.(record)}
          >
            查看
          </Button>
          {isAdmin && record.status === 'pending' && (
            <>
              <Popconfirm
                title="确定要批准这个申请吗？"
                description="批准后将自动创建或删除学生账号"
                onConfirm={() => handleApprove(record)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  icon={<CheckOutlined />}
                  style={{ color: '#52c41a' }}
                >
                  批准
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定要拒绝这个申请吗？"
                description="拒绝后申请人需要重新提交"
                onConfirm={() => handleReject(record)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                >
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // 行选择配置
  const rowSelection = isAdmin ? {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: Request) => ({
      disabled: record.status !== 'pending',
    }),
  } : undefined;

  return (
    <Card>
      {/* 搜索和过滤区域 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Search
            placeholder="搜索PI用户名、姓名或理由"
            allowClear
            style={{ width: 250 }}
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 120 }}
            value={statusFilter || undefined}
            onChange={handleStatusFilter}
          >
            {requestService.getStatusOptions().map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
          {!isAdmin && (
            <Select
              placeholder="筛选类型"
              allowClear
              style={{ width: 120 }}
              value={typeFilter || undefined}
              onChange={handleTypeFilter}
            >
              {requestService.getTypeOptions().map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          )}
        </Space>
        {isAdmin && selectedRowKeys.length > 0 && (
          <Space>
            <span>{selectedRowKeys.length} 项已选择</span>
            <Button type="primary" size="small">批量批准</Button>
            <Button danger size="small">批量拒绝</Button>
          </Space>
        )}
      </div>

      {/* 申请列表表格 */}
      <Table
        columns={columns}
        dataSource={filteredRequests}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          onChange: (page, pageSize) => {
            loadRequests(page, pageSize, statusFilter, typeFilter);
          },
        }}
        scroll={{ x: 1000 }}
      />
    </Card>
  );
};

export default RequestList;