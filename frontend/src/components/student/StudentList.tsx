import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, message, Popconfirm, Input, Select, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Student } from '../../types';
import { studentService } from '../../services/student';

const { Search } = Input;
const { Option } = Select;

interface StudentListProps {
  onCreateStudent?: () => void;
  onEditStudent?: (student: Student) => void;
}

const StudentList: React.FC<StudentListProps> = ({
  onCreateStudent,
  onEditStudent
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  // 加载组用户列表
  const loadStudents = async (page = 1, pageSize = 10, status?: string) => {
    setLoading(true);
    try {
      const response = await studentService.getMyStudents(page, pageSize, status);
      if (response.success && response.data) {
        setStudents(response.data.items);
        setPagination({
          current: page,
          pageSize,
          total: response.data.total,
        });
      } else {
        message.error('加载组用户列表失败: ' + response.message);
      }
    } catch (error) {
      message.error('加载组用户列表失败');
      console.error('Load students error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadStudents();
  }, []);

  // 删除组用户申请
  const handleDeleteStudent = async (student: Student) => {
    try {
      const response = await studentService.deleteStudentRequest({
        student_id: student.id,
        reason: '删除组用户账号'
      });
      
      if (response.success) {
        message.success('删除申请已提交');
        loadStudents(pagination.current, pagination.pageSize, statusFilter);
      } else {
        message.error('提交删除申请失败: ' + response.message);
      }
    } catch (error) {
      message.error('提交删除申请失败');
      console.error('Delete student error:', error);
    }
  };

  // 状态过滤
  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    loadStudents(1, pagination.pageSize, value || undefined);
  };

  // 搜索功能
  const handleSearch = (value: string) => {
    setSearchText(value);
    // 这里可以添加本地搜索逻辑或调用API搜索
  };

  // 过滤组用户数据
  const filteredStudents = students.filter(student => {
    if (!searchText) return true;
    return (
      student.username?.toLowerCase().includes(searchText.toLowerCase()) ||
      student.chinese_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  // 表格列定义
  const columns = [
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: Student) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEditStudent?.(record)}
          >
            编辑
          </Button>
          {record.status === 'active' && (
            <Popconfirm
              title="确定要删除这个组用户吗？"
              description="删除后将提交删除申请给管理员审核"
              onConfirm={() => handleDeleteStudent(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
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
            placeholder="搜索用户名、姓名或邮箱"
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
            {studentService.getStatusOptions().map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onCreateStudent}
        >
          添加组用户
        </Button>
      </div>

      {/* 组用户列表表格 */}
      <Table
        columns={columns}
        dataSource={filteredStudents}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          onChange: (page, pageSize) => {
            loadStudents(page, pageSize, statusFilter);
          },
        }}
        scroll={{ x: 800 }}
      />
    </Card>
  );
};

export default StudentList;