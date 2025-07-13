import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Button,
  Form,
  Select,
  Input,
  DatePicker,
  InputNumber,
  Alert,
  Space,
  Typography,
  Divider,
  Tag,
  List,
  Row,
  Col,
  message,
  Tooltip,
  Descriptions,
  Steps
} from 'antd';
import {
  UserSwitchOutlined,
  CrownOutlined,
  TeamOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { roleAssignmentService } from '../../services/roleAssignment';
import { User, PIUser, Student, RoleValidation } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Step } = Steps;

interface RoleAssignmentModalProps {
  visible: boolean;
  user: User | null;
  mode: 'assign' | 'change';
  onCancel: () => void;
  onSuccess?: () => void;
}

const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({
  visible,
  user,
  mode,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [roleType, setRoleType] = useState<'pi' | 'student'>('pi');
  const [validation, setValidation] = useState<RoleValidation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);

  // 重置表单和状态
  const resetState = () => {
    form.resetFields();
    setCurrentStep(0);
    setRoleType('pi');
    setValidation(null);
    setSubmitting(false);
    setValidating(false);
  };

  // 组件初始化
  useEffect(() => {
    if (visible && user) {
      resetState();
      if (user.user_type !== 'unassigned') {
        setRoleType(user.user_type as 'pi' | 'student');
      }
    }
  }, [visible, user]);

  // 验证角色分配
  const validateRoleAssignment = async () => {
    if (!user) return;

    setValidating(true);
    try {
      const response = await roleAssignmentService.validateRoleAssignment(user.id, roleType);
      if (response.success && response.data) {
        setValidation(response.data);
        setCurrentStep(1);
      } else {
        message.error(response.message || '验证失败');
      }
    } catch (error) {
      message.error('验证角色分配失败');
    } finally {
      setValidating(false);
    }
  };

  // 提交角色分配
  const handleSubmit = async () => {
    if (!user || !validation) return;

    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const roleData = {
        ...values,
        // 处理日期字段
        join_date: values.join_date?.format('YYYY-MM-DD'),
        expected_graduation: values.expected_graduation?.format('YYYY-MM-DD')
      };

      let response;
      if (mode === 'assign') {
        response = await roleAssignmentService.assignUserRole(user.id, roleType, roleData);
      } else {
        response = await roleAssignmentService.changeUserRole(user.id, roleType, roleData);
      }

      if (response.success) {
        message.success(`用户角色${mode === 'assign' ? '分配' : '更改'}成功`);
        if (onSuccess) {
          onSuccess();
        }
        onCancel();
      } else {
        message.error(response.message || `角色${mode === 'assign' ? '分配' : '更改'}失败`);
      }
    } catch (error) {
      message.error(`角色${mode === 'assign' ? '分配' : '更改'}失败`);
    } finally {
      setSubmitting(false);
    }
  };

  // 上一步
  const handlePrevStep = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  // 下一步
  const handleNextStep = () => {
    if (currentStep === 0) {
      validateRoleAssignment();
    } else {
      setCurrentStep(Math.min(2, currentStep + 1));
    }
  };

  // 关闭模态框
  const handleCancel = () => {
    if (!submitting && !validating) {
      resetState();
      onCancel();
    }
  };

  // 渲染用户信息
  const renderUserInfo = () => {
    if (!user) return null;

    return (
      <Card title="用户信息" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
          <Descriptions.Item label="姓名">{user.full_name}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
          <Descriptions.Item label="电话">{user.phone || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="当前角色">
            <Tag color={roleAssignmentService.getUserTypeColor(user.user_type)}>
              {roleAssignmentService.getUserTypeText(user.user_type)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="课题组">
            {roleAssignmentService.formatResearchGroup(user)}
          </Descriptions.Item>
          <Descriptions.Item label="UID">{user.uid_number || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="GID">{user.gid_number || '未设置'}</Descriptions.Item>
        </Descriptions>
        
        {/* 智能建议 */}
        <Divider />
        <Alert
          type="info"
          message="角色分配建议"
          description={roleAssignmentService.generateRoleAssignmentSuggestion(user)}
          showIcon
          icon={<InfoCircleOutlined />}
        />
      </Card>
    );
  };

  // 渲染角色选择步骤
  const renderRoleSelection = () => (
    <div>
      <Title level={4}>选择角色类型</Title>
      <Paragraph type="secondary">
        请为用户选择合适的角色类型。系统会根据用户信息进行验证。
      </Paragraph>
      
      <Row gutter={16}>
        <Col span={12}>
          <Card
            hoverable
            className={roleType === 'pi' ? 'role-card-selected' : ''}
            onClick={() => setRoleType('pi')}
            style={{
              border: roleType === 'pi' ? '2px solid #1890ff' : '1px solid #d9d9d9',
              cursor: 'pointer'
            }}
          >
            <Card.Meta
              avatar={<CrownOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
              title="PI用户"
              description="主要研究者，可以管理学生和研究项目"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card
            hoverable
            className={roleType === 'student' ? 'role-card-selected' : ''}
            onClick={() => setRoleType('student')}
            style={{
              border: roleType === 'student' ? '2px solid #52c41a' : '1px solid #d9d9d9',
              cursor: 'pointer'
            }}
          >
            <Card.Meta
              avatar={<TeamOutlined style={{ fontSize: 24, color: '#52c41a' }} />}
              title="学生"
              description="研究生或本科生，隶属于某个PI导师"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );

  // 渲染验证结果步骤
  const renderValidationResult = () => {
    if (!validation) return null;

    return (
      <div>
        <Title level={4}>验证结果</Title>
        
        <Alert
          type={validation.isValid ? 'success' : 'warning'}
          message={validation.isValid ? '验证通过' : '发现潜在问题'}
          description={validation.isValid ? '该用户可以分配为此角色' : '请注意以下警告信息'}
          showIcon
          icon={validation.isValid ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
        />

        {validation.warnings.length > 0 && (
          <Card title="警告信息" size="small" style={{ marginBottom: 16 }}>
            <List
              size="small"
              dataSource={validation.warnings}
              renderItem={(warning) => (
                <List.Item>
                  <Space>
                    <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                    <Text>{warning}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {validation.suggestions.length > 0 && (
          <Card title="建议信息" size="small">
            <List
              size="small"
              dataSource={validation.suggestions}
              renderItem={(suggestion) => (
                <List.Item>
                  <Space>
                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    <Text>{suggestion}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}
      </div>
    );
  };

  // 渲染详细信息步骤
  const renderRoleDetailsForm = () => (
    <div>
      <Title level={4}>填写角色详细信息</Title>
      
      <Form form={form} layout="vertical">
        {roleType === 'pi' && (
          <>
            <Form.Item
              name="department"
              label="所属部门"
              rules={[{ required: true, message: '请输入所属部门' }]}
            >
              <Input placeholder="请输入所属部门" />
            </Form.Item>
            
            <Form.Item
              name="office_location"
              label="办公室位置"
            >
              <Input placeholder="请输入办公室位置" />
            </Form.Item>
            
            <Form.Item
              name="research_area"
              label="研究领域"
            >
              <Input.TextArea rows={3} placeholder="请输入研究领域描述" />
            </Form.Item>
            
            <Form.Item
              name="max_students"
              label="最大学生数"
              initialValue={10}
            >
              <InputNumber min={1} max={50} placeholder="最大可指导学生数" />
            </Form.Item>
          </>
        )}

        {roleType === 'student' && (
          <>
            <Form.Item
              name="student_id"
              label="学号"
            >
              <Input placeholder="请输入学号" />
            </Form.Item>
            
            <Form.Item
              name="major"
              label="专业"
            >
              <Input placeholder="请输入专业" />
            </Form.Item>
            
            <Form.Item
              name="degree_level"
              label="学位层次"
            >
              <Select placeholder="请选择学位层次">
                {roleAssignmentService.getDegreeLevelOptions().map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item
              name="enrollment_year"
              label="入学年份"
            >
              <InputNumber min={2000} max={new Date().getFullYear()} placeholder="入学年份" />
            </Form.Item>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="join_date"
                  label="加入课题组日期"
                >
                  <DatePicker style={{ width: '100%' }} placeholder="选择加入日期" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="expected_graduation"
                  label="预期毕业时间"
                >
                  <DatePicker style={{ width: '100%' }} placeholder="选择预期毕业时间" />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}
      </Form>
    </div>
  );

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderRoleSelection();
      case 1:
        return renderValidationResult();
      case 2:
        return renderRoleDetailsForm();
      default:
        return null;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <UserSwitchOutlined />
          {mode === 'assign' ? '分配用户角色' : '更改用户角色'}
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={submitting || validating}>
          取消
        </Button>,
        currentStep > 0 && (
          <Button key="prev" onClick={handlePrevStep} disabled={submitting || validating}>
            上一步
          </Button>
        ),
        currentStep < 2 ? (
          <Button
            key="next"
            type="primary"
            onClick={handleNextStep}
            loading={validating}
            disabled={submitting}
          >
            {currentStep === 0 ? '验证角色' : '下一步'}
          </Button>
        ) : (
          <Button
            key="submit"
            type="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={validating || !validation?.isValid}
          >
            确认{mode === 'assign' ? '分配' : '更改'}
          </Button>
        )
      ].filter(Boolean)}
      width={800}
      maskClosable={!submitting && !validating}
    >
      {/* 用户信息 */}
      {renderUserInfo()}

      {/* 步骤指示器 */}
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Step title="选择角色" description="选择要分配的角色类型" />
        <Step title="验证角色" description="验证角色分配的合理性" />
        <Step title="填写详情" description="填写角色相关的详细信息" />
      </Steps>

      {/* 步骤内容 */}
      {renderStepContent()}
    </Modal>
  );
};

export default RoleAssignmentModal;