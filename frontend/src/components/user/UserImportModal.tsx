import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Button,
  Progress,
  Alert,
  Space,
  Statistic,
  Row,
  Col,
  List,
  Typography,
  Divider,
  Tag,
  Input,
  Form,
  Select,
  message,
  Tooltip
} from 'antd';
import {
  ImportOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloudServerOutlined,
  UsergroupAddOutlined,
  UserSwitchOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { userImportService } from '../../services/userImport';
import { UserImportResult, SyncLog } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface UserImportModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

type ImportType = 'all' | 'specific' | 'group';

const UserImportModal: React.FC<UserImportModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<ImportType>('all');
  const [importResult, setImportResult] = useState<UserImportResult | null>(null);
  const [ldapValidation, setLdapValidation] = useState<{
    isConnected: boolean;
    userCount: number;
    error?: string;
  } | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [validateLoading, setValidateLoading] = useState(false);

  // 验证LDAP连接
  const validateLDAP = async () => {
    setValidateLoading(true);
    try {
      const response = await userImportService.validateLDAPConnection();
      if (response.success && response.data) {
        setLdapValidation(response.data);
        if (response.data.isConnected) {
          message.success(`LDAP连接正常，发现 ${response.data.userCount} 个用户`);
        } else {
          message.error(response.data.error || 'LDAP连接失败');
        }
      }
    } catch (error) {
      message.error('验证LDAP连接失败');
    } finally {
      setValidateLoading(false);
    }
  };

  // 加载同步历史
  const loadSyncHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await userImportService.getSyncHistory(10);
      if (response.success && response.data) {
        setSyncHistory(response.data.sync_logs);
      }
    } catch (error) {
      console.error('加载同步历史失败:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 组件初始化
  useEffect(() => {
    if (visible) {
      validateLDAP();
      loadSyncHistory();
      form.resetFields();
      setImportResult(null);
    }
  }, [visible, form]);

  // 执行导入
  const handleImport = async () => {
    try {
      const values = await form.validateFields();
      setImporting(true);
      setImportResult(null);

      let response;
      
      switch (importType) {
        case 'all':
          response = await userImportService.importAllUsersFromLDAP();
          break;
        case 'specific':
          const usernames = values.usernames.split(/[,\n]/).map((u: string) => u.trim()).filter(Boolean);
          if (usernames.length === 0) {
            message.error('请输入有效的用户名');
            return;
          }
          response = await userImportService.importSpecificUsers(usernames);
          break;
        case 'group':
          response = await userImportService.importUsersByResearchGroup(values.gid_number);
          break;
        default:
          throw new Error('未知的导入类型');
      }

      if (response.success && response.data) {
        setImportResult(response.data.import_result);
        message.success(response.data.message);
        
        // 重新加载同步历史
        loadSyncHistory();
        
        // 通知父组件
        if (onSuccess) {
          onSuccess();
        }
      } else {
        message.error(response.message || '导入失败');
      }
    } catch (error) {
      message.error('导入操作失败');
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  // 关闭模态框
  const handleCancel = () => {
    if (!importing) {
      form.resetFields();
      setImportResult(null);
      onCancel();
    }
  };

  // 渲染导入结果
  const renderImportResult = () => {
    if (!importResult) return null;

    const { total_found, new_imported, updated, marked_deleted, errors, duration_ms } = importResult;
    const hasErrors = errors.length > 0;

    return (
      <Card 
        title={
          <Space>
            {hasErrors ? (
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
            导入结果
          </Space>
        }
        style={{ marginTop: 16 }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="发现用户"
              value={total_found}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="新导入"
              value={new_imported}
              prefix={<UsergroupAddOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已更新"
              value={updated}
              prefix={<UserSwitchOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="标记删除"
              value={marked_deleted}
              prefix={<DeleteOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Col>
        </Row>

        <Divider />

        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            导入耗时: <Tag color="blue">{userImportService.formatDuration(duration_ms)}</Tag>
          </Text>
          
          {hasErrors && (
            <Alert
              type="warning"
              message={`导入过程中发生了 ${errors.length} 个错误`}
              description={
                <List
                  size="small"
                  dataSource={errors.slice(0, 5)}
                  renderItem={(error, index) => (
                    <List.Item key={index}>
                      <Text type="danger" style={{ fontSize: '12px' }}>{error}</Text>
                    </List.Item>
                  )}
                  footer={errors.length > 5 && <Text type="secondary">还有 {errors.length - 5} 个错误...</Text>}
                />
              }
              showIcon
            />
          )}
        </Space>
      </Card>
    );
  };

  // 渲染同步历史
  const renderSyncHistory = () => (
    <Card title="最近同步历史" loading={loadingHistory} style={{ marginTop: 16 }}>
      <List
        size="small"
        dataSource={syncHistory}
        renderItem={(log) => {
          const statusColor = userImportService.getSyncStatusColor(log);
          const statusText = userImportService.getSyncStatusText(log);
          
          return (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={statusColor}>{statusText}</Tag>
                    <Text>{userImportService.formatSyncType(log.sync_type)}</Text>
                    {log.duration_seconds && (
                      <Text type="secondary">({log.duration_seconds}s)</Text>
                    )}
                  </Space>
                }
                description={
                  <Space>
                    <Text>新增: {log.new_users}</Text>
                    <Text>更新: {log.updated_users}</Text>
                    <Text>删除: {log.deleted_users}</Text>
                    <Text type="secondary">{new Date(log.started_at).toLocaleString()}</Text>
                  </Space>
                }
              />
            </List.Item>
          );
        }}
        locale={{ emptyText: '暂无同步历史' }}
      />
    </Card>
  );

  return (
    <Modal
      title={
        <Space>
          <ImportOutlined />
          LDAP用户导入
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={importing}>
          取消
        </Button>,
        <Button
          key="validate"
          onClick={validateLDAP}
          loading={validateLoading}
          disabled={importing}
        >
          验证连接
        </Button>,
        <Button
          key="import"
          type="primary"
          onClick={handleImport}
          loading={importing}
          disabled={!ldapValidation?.isConnected}
          icon={importing ? <SyncOutlined spin /> : <ImportOutlined />}
        >
          {importing ? '导入中...' : '开始导入'}
        </Button>
      ]}
      width={800}
      maskClosable={!importing}
    >
      {/* LDAP连接状态 */}
      {ldapValidation && (
        <Alert
          type={ldapValidation.isConnected ? 'success' : 'error'}
          message={
            ldapValidation.isConnected
              ? `LDAP连接正常，发现 ${ldapValidation.userCount} 个用户`
              : 'LDAP连接失败'
          }
          description={ldapValidation.error}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 导入选项 */}
      <Card title="导入选项">
        <Form form={form} layout="vertical">
          <Form.Item label="导入类型" required>
            <Select
              value={importType}
              onChange={setImportType}
              disabled={importing}
            >
              <Option value="all">
                <Space>
                  <CloudServerOutlined />
                  导入所有用户
                </Space>
              </Option>
              <Option value="specific">
                <Space>
                  <UsergroupAddOutlined />
                  导入指定用户
                </Space>
              </Option>
              <Option value="group">
                <Space>
                  <UserSwitchOutlined />
                  按课题组导入
                </Space>
              </Option>
            </Select>
          </Form.Item>

          {importType === 'specific' && (
            <Form.Item
              name="usernames"
              label="用户名列表"
              rules={[{ required: true, message: '请输入用户名' }]}
              extra="多个用户名用逗号或换行分隔"
            >
              <Input.TextArea
                rows={4}
                placeholder="请输入用户名，例如：&#10;user1, user2&#10;user3"
                disabled={importing}
              />
            </Form.Item>
          )}

          {importType === 'group' && (
            <Form.Item
              name="gid_number"
              label="课题组GID"
              rules={[
                { required: true, message: '请输入课题组GID' },
                { type: 'number', min: 1000, message: 'GID必须是大于1000的数字' }
              ]}
            >
              <Input
                type="number"
                placeholder="请输入课题组的GID编号"
                disabled={importing}
              />
            </Form.Item>
          )}
        </Form>

        {importType === 'all' && (
          <Alert
            type="info"
            message="全量导入说明"
            description={
              <div>
                <Paragraph>
                  全量导入将从LDAP服务器获取所有用户信息并导入到系统中：
                </Paragraph>
                <ul>
                  <li>新用户将被创建，初始角色为"未分配"</li>
                  <li>现有用户的基础信息将被更新</li>
                  <li>在LDAP中已删除的用户将被标记为"已从LDAP删除"</li>
                  <li>导入后需要管理员手动分配用户角色</li>
                </ul>
              </div>
            }
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* 导入进度 */}
      {importing && (
        <Card title="导入进度" style={{ marginTop: 16 }}>
          <Progress percent={100} status="active" />
          <Text type="secondary">正在从LDAP导入用户数据，请稍候...</Text>
        </Card>
      )}

      {/* 导入结果 */}
      {renderImportResult()}

      {/* 同步历史 */}
      {renderSyncHistory()}
    </Modal>
  );
};

export default UserImportModal;