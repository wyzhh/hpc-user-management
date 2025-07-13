import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Row,
  Col,
  Tooltip,
  message,
  Modal,
  Descriptions,
  List,
  Avatar,
  Statistic,
  Alert,
  Typography,
  Popconfirm
} from 'antd';
import {
  TeamOutlined,
  CrownOutlined,
  UserOutlined,
  EyeOutlined,
  SettingOutlined,
  ReloadOutlined,
  SearchOutlined,
  UsergroupAddOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { roleAssignmentService } from '../../services/roleAssignment';
import { RoleAssignmentStats, User, RoleSuggestion } from '../../types';
import RoleAssignmentModal from '../user/RoleAssignmentModal';

const { Search } = Input;
const { Title, Text } = Typography;

interface ResearchGroupInfo {
  gid_number: number;
  user_count: number;
  pi_count: number;
  student_count: number;
  unassigned_count: number;
  users: User[];
}

const ResearchGroupManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ResearchGroupInfo[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<ResearchGroupInfo[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ResearchGroupInfo | null>(null);
  const [groupDetailVisible, setGroupDetailVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [suggestions, setSuggestions] = useState<RoleSuggestion | null>(null);
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);

  // 加载课题组数据
  const loadGroups = async () => {
    setLoading(true);
    try {
      // 获取角色分配统计
      const statsResponse = await roleAssignmentService.getRoleAssignmentStats();
      if (statsResponse.success && statsResponse.data) {
        const groupsData: ResearchGroupInfo[] = [];
        
        // 为每个课题组获取详细用户信息
        for (const groupStat of statsResponse.data.by_research_group) {
          try {
            // 获取该课题组的所有用户
            const usersResponse = await roleAssignmentService.getAllUsers(1, 100, {
              gid_number: groupStat.gid_number
            });
            
            if (usersResponse.success && usersResponse.data) {
              const users = usersResponse.data.users;
              const unassignedCount = users.filter(u => u.user_type === 'unassigned').length;
              
              groupsData.push({
                gid_number: groupStat.gid_number,
                user_count: groupStat.user_count,
                pi_count: groupStat.pi_count,
                student_count: groupStat.student_count,
                unassigned_count: unassignedCount,
                users
              });
            }
          } catch (error) {
            console.error(`获取课题组 ${groupStat.gid_number} 用户失败:`, error);
          }
        }
        
        setGroups(groupsData);
        setFilteredGroups(groupsData);
      }
    } catch (error) {
      message.error('加载课题组数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadGroups();
  }, []);

  // 搜索课题组
  const handleSearch = (value: string) => {
    if (!value) {
      setFilteredGroups(groups);
    } else {
      const filtered = groups.filter(group => 
        group.gid_number.toString().includes(value)
      );
      setFilteredGroups(filtered);
    }
  };

  // 查看课题组详情
  const handleViewGroup = (group: ResearchGroupInfo) => {
    setSelectedGroup(group);
    setGroupDetailVisible(true);
  };

  // 分配用户角色
  const handleAssignRole = (user: User) => {
    setSelectedUser(user);
    setRoleModalVisible(true);
  };

  // 获取角色推荐
  const handleGetSuggestions = async (group: ResearchGroupInfo) => {
    try {
      const response = await roleAssignmentService.suggestRolesByResearchGroup(group.gid_number);
      if (response.success && response.data) {
        setSuggestions(response.data);
        setSelectedGroup(group);
        setSuggestionModalVisible(true);
      } else {
        message.error(response.message || '获取角色推荐失败');
      }
    } catch (error) {
      message.error('获取角色推荐失败');
    }
  };

  // 批量应用推荐
  const handleApplySuggestions = async () => {
    if (!suggestions || !selectedGroup) return;

    const assignments = [
      ...suggestions.suggestedPI.map(user => ({
        user_id: user.id,
        role_type: 'pi' as const,
        role_data: { department: '未设置' }
      })),
      ...suggestions.suggestedStudents.map(user => ({
        user_id: user.id,
        role_type: 'student' as const,
        role_data: {}
      }))
    ];

    if (assignments.length === 0) {
      message.info('没有可应用的推荐');
      return;
    }

    try {
      const response = await roleAssignmentService.batchAssignRoles(assignments);
      if (response.success && response.data) {
        message.success(`批量分配完成: 成功 ${response.data.successful} 个，失败 ${response.data.failed.length} 个`);
        setSuggestionModalVisible(false);
        loadGroups(); // 重新加载数据
      } else {
        message.error('批量分配失败');
      }
    } catch (error) {
      message.error('批量分配失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '课题组GID',
      dataIndex: 'gid_number',
      key: 'gid_number',
      width: 120,
      render: (gid: number) => (
        <Tag color="blue" style={{ fontSize: '14px', fontWeight: 'bold' }}>
          {gid}
        </Tag>
      )
    },
    {
      title: '用户总数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 100,
      render: (count: number) => (
        <Statistic value={count} valueStyle={{ fontSize: '16px' }} />
      )
    },
    {
      title: 'PI数量',
      dataIndex: 'pi_count',
      key: 'pi_count',
      width: 80,
      render: (count: number) => (
        <Space>
          <CrownOutlined style={{ color: '#722ed1' }} />
          <Text>{count}</Text>
        </Space>
      )
    },
    {
      title: '学生数量',
      dataIndex: 'student_count',
      key: 'student_count',
      width: 80,
      render: (count: number) => (
        <Space>
          <TeamOutlined style={{ color: '#52c41a' }} />
          <Text>{count}</Text>
        </Space>
      )
    },
    {
      title: '未分配角色',
      dataIndex: 'unassigned_count',
      key: 'unassigned_count',
      width: 100,
      render: (count: number) => (
        <Space>
          <ExclamationCircleOutlined style={{ color: count > 0 ? '#faad14' : '#d9d9d9' }} />
          <Text type={count > 0 ? 'warning' : 'secondary'}>{count}</Text>
        </Space>
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_: any, record: ResearchGroupInfo) => {
        if (record.unassigned_count > 0) {
          return <Tag color="orange">需要分配角色</Tag>;
        } else if (record.pi_count === 0) {
          return <Tag color="red">缺少PI</Tag>;
        } else if (record.pi_count > 1) {
          return <Tag color="blue">多PI课题组</Tag>;
        } else {
          return <Tag color="green">正常</Tag>;
        }
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: ResearchGroupInfo) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewGroup(record)}
            />
          </Tooltip>
          {record.unassigned_count > 0 && (
            <Tooltip title="角色推荐">
              <Button
                type="text"
                icon={<UsergroupAddOutlined />}
                onClick={() => handleGetSuggestions(record)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  // 渲染用户列表
  const renderUserList = (users: User[], title: string, icon: React.ReactNode, color: string) => (
    <Card 
      title={
        <Space>
          {icon}
          {title} ({users.length})
        </Space>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      <List
        size="small"
        dataSource={users}
        renderItem={(user) => (
          <List.Item
            actions={[
              user.user_type === 'unassigned' && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleAssignRole(user)}
                >
                  分配角色
                </Button>
              )
            ].filter(Boolean)}
          >
            <List.Item.Meta
              avatar={<Avatar icon={<UserOutlined />} size="small" />}
              title={
                <Space>
                  <Text>{user.full_name}</Text>
                  <Text type="secondary">({user.username})</Text>
                  <Tag 
                    color={roleAssignmentService.getUserTypeColor(user.user_type)}
                  >
                    {roleAssignmentService.getUserTypeText(user.user_type)}
                  </Tag>
                </Space>
              }
              description={user.email}
            />
          </List.Item>
        )}
        locale={{ emptyText: `暂无${title}` }}
      />
    </Card>
  );

  return (
    <div>
      <Card>
        {/* 操作栏 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Search
              placeholder="搜索课题组GID"
              allowClear
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={12}>
            <Space style={{ float: 'right' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadGroups}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 统计信息 */}
        <Alert
          message={
            <Space>
              <Text>共 {filteredGroups.length} 个课题组</Text>
              <Text type="secondary">|</Text>
              <Text>需要角色分配: {filteredGroups.filter(g => g.unassigned_count > 0).length}</Text>
              <Text type="secondary">|</Text>
              <Text>缺少PI: {filteredGroups.filter(g => g.pi_count === 0).length}</Text>
              <Text type="secondary">|</Text>
              <Text>多PI: {filteredGroups.filter(g => g.pi_count > 1).length}</Text>
            </Space>
          }
          type="info"
          style={{ marginBottom: 16 }}
        />

        {/* 课题组表格 */}
        <Table
          columns={columns}
          dataSource={filteredGroups}
          rowKey="gid_number"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          size="small"
        />
      </Card>

      {/* 课题组详情模态框 */}
      <Modal
        title={
          <Space>
            <TeamOutlined />
            课题组 {selectedGroup?.gid_number} 详情
          </Space>
        }
        open={groupDetailVisible}
        onCancel={() => setGroupDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setGroupDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedGroup && (
          <div>
            {/* 统计信息 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Statistic title="用户总数" value={selectedGroup.user_count} prefix={<UserOutlined />} />
              </Col>
              <Col span={6}>
                <Statistic title="PI数量" value={selectedGroup.pi_count} prefix={<CrownOutlined />} />
              </Col>
              <Col span={6}>
                <Statistic title="学生数量" value={selectedGroup.student_count} prefix={<TeamOutlined />} />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="未分配角色" 
                  value={selectedGroup.unassigned_count} 
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: selectedGroup.unassigned_count > 0 ? '#faad14' : '#52c41a' }}
                />
              </Col>
            </Row>

            {/* 用户列表 */}
            {renderUserList(
              selectedGroup.users.filter(u => u.user_type === 'pi'),
              'PI用户',
              <CrownOutlined style={{ color: '#722ed1' }} />,
              '#722ed1'
            )}

            {renderUserList(
              selectedGroup.users.filter(u => u.user_type === 'student'),
              '学生用户',
              <TeamOutlined style={{ color: '#52c41a' }} />,
              '#52c41a'
            )}

            {selectedGroup.unassigned_count > 0 && (
              <>
                {renderUserList(
                  selectedGroup.users.filter(u => u.user_type === 'unassigned'),
                  '未分配角色用户',
                  <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
                  '#faad14'
                )}
                
                <Card size="small">
                  <Alert
                    message="建议"
                    description="该课题组有用户尚未分配角色，建议使用角色推荐功能快速分配。"
                    type="info"
                    showIcon
                    action={
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => handleGetSuggestions(selectedGroup)}
                      >
                        获取角色推荐
                      </Button>
                    }
                  />
                </Card>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* 角色推荐模态框 */}
      <Modal
        title={
          <Space>
            <UsergroupAddOutlined />
            课题组 {selectedGroup?.gid_number} - 角色推荐
          </Space>
        }
        open={suggestionModalVisible}
        onCancel={() => setSuggestionModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSuggestionModalVisible(false)}>
            取消
          </Button>,
          <Popconfirm
            key="apply"
            title="确定要批量应用这些角色推荐吗？"
            onConfirm={handleApplySuggestions}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="primary"
              disabled={!suggestions || (suggestions.suggestedPI.length + suggestions.suggestedStudents.length === 0)}
            >
              批量应用推荐
            </Button>
          </Popconfirm>
        ]}
        width={800}
      >
        {suggestions && (
          <div>
            <Alert
              message="推荐说明"
              description={suggestions.reasoning}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {suggestions.suggestedPI.length > 0 && (
              <Card title="推荐为PI用户" size="small" style={{ marginBottom: 16 }}>
                <List
                  size="small"
                  dataSource={suggestions.suggestedPI}
                  renderItem={(user) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<CrownOutlined />} style={{ backgroundColor: '#722ed1' }} size="small" />}
                        title={`${user.full_name} (${user.username})`}
                        description={user.email}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {suggestions.suggestedStudents.length > 0 && (
              <Card title="推荐为学生用户" size="small">
                <List
                  size="small"
                  dataSource={suggestions.suggestedStudents}
                  renderItem={(user) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<TeamOutlined />} style={{ backgroundColor: '#52c41a' }} size="small" />}
                        title={`${user.full_name} (${user.username})`}
                        description={user.email}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {suggestions.suggestedPI.length === 0 && suggestions.suggestedStudents.length === 0 && (
              <Alert
                message="无推荐结果"
                description="系统无法为该课题组的用户生成角色推荐，建议手动分配角色。"
                type="warning"
                showIcon
              />
            )}
          </div>
        )}
      </Modal>

      {/* 角色分配模态框 */}
      <RoleAssignmentModal
        visible={roleModalVisible}
        user={selectedUser}
        mode="assign"
        onCancel={() => setRoleModalVisible(false)}
        onSuccess={() => {
          setRoleModalVisible(false);
          loadGroups(); // 重新加载数据
        }}
      />
    </div>
  );
};

export default ResearchGroupManagement;