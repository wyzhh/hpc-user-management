import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Modal, Space } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined, UserAddOutlined } from '@ant-design/icons';
import { CreateStudentRequest, Student } from '../../types';
import { studentService } from '../../services/student';

const { TextArea } = Input;

interface StudentFormProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  student?: Student | null;
  mode: 'create' | 'edit';
}

const StudentForm: React.FC<StudentFormProps> = ({
  visible,
  onCancel,
  onSuccess,
  student,
  mode
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null);

  // 重置表单
  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && student) {
        form.setFieldsValue({
          username: student.username,
          chinese_name: student.chinese_name,
          email: student.email,
          phone: student.phone,
        });
      } else {
        form.resetFields();
        setUsernameAvailable(null);
      }
    }
  }, [visible, mode, student, form]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (checkTimeout) {
        clearTimeout(checkTimeout);
      }
    };
  }, [checkTimeout]);

  // 检查用户名可用性
  const checkUsername = async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // 如果是编辑模式且用户名没有改变，不需要检查
    if (mode === 'edit' && student && username === student.username) {
      setUsernameAvailable(true);
      return;
    }

    setUsernameChecking(true);
    try {
      const response = await studentService.checkUsernameAvailability(username);
      if (response.success && response.data) {
        setUsernameAvailable(response.data.available);
        if (!response.data.available) {
          form.setFields([{
            name: 'username',
            errors: [response.data.reason]
          }]);
        }
      }
    } catch (error) {
      console.error('Check username error:', error);
    } finally {
      setUsernameChecking(false);
    }
  };

  // 表单提交
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (mode === 'create') {
        const createData: CreateStudentRequest = {
          username: values.username,
          chinese_name: values.chinese_name,
          email: values.email,
          phone: values.phone,
          password: values.password
        };

        const response = await studentService.createStudentRequest(createData);
        if (response.success) {
          message.success('组用户创建申请已提交，请等待管理员审核');
          onSuccess();
        } else {
          message.error('提交申请失败: ' + response.message);
        }
      } else {
        // 编辑模式 - 这里需要根据实际API调整
        message.info('编辑功能暂未实现');
      }
    } catch (error) {
      message.error('操作失败');
      console.error('Submit form error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 表单验证规则
  const formRules = {
    username: [
      { required: true, message: '请输入用户名' },
      { min: 3, message: '用户名至少需要3个字符' },
      { max: 50, message: '用户名不能超过50个字符' },
      { pattern: /^[a-zA-Z0-9]+$/, message: '用户名只能包含字母和数字' },
      {
        validator: async (_: any, value: string) => {
          if (value && mode === 'create') {
            const validation = studentService.validateUsername(value);
            if (!validation.valid) {
              throw new Error(validation.message);
            }
            if (usernameAvailable === false) {
              throw new Error('用户名已被使用');
            }
          }
        }
      }
    ],
    chinese_name: [
      { required: true, message: '请输入中文姓名' },
      { min: 2, message: '中文姓名至少需要2个字符' },
      { max: 50, message: '中文姓名不能超过50个字符' }
    ],
    email: [
      { required: true, message: '请输入邮箱地址' },
      { type: 'email' as const, message: '邮箱格式不正确' }
    ],
    phone: [
      { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
    ],
    password: mode === 'create' ? [
      { required: true, message: '请输入组用户密码' },
      { min: 6, message: '密码至少需要6个字符' },
      { max: 50, message: '密码不能超过50个字符' }
    ] : []
  };

  return (
    <Modal
      title={mode === 'create' ? '添加组用户' : '编辑组用户'}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 20 }}
      >
        <Form.Item
          name="username"
          label="用户名"
          rules={formRules.username}
          hasFeedback
          validateStatus={
            usernameChecking ? 'validating' : 
            usernameAvailable === false ? 'error' : 
            usernameAvailable === true ? 'success' : ''
          }
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入用户名（字母和数字组合）"
            disabled={mode === 'edit'}
            onChange={(e) => {
              const value = e.target.value;
              if (mode === 'create') {
                // 清除之前的防抖定时器
                if (checkTimeout) {
                  clearTimeout(checkTimeout);
                }
                // 设置新的防抖定时器，延长到1秒
                const newTimeout = setTimeout(() => checkUsername(value), 1000);
                setCheckTimeout(newTimeout);
              }
            }}
          />
        </Form.Item>

        <Form.Item
          name="chinese_name"
          label="中文姓名"
          rules={formRules.chinese_name}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入中文姓名"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="邮箱地址"
          rules={formRules.email}
        >
          <Input
            prefix={<MailOutlined />}
            placeholder="请输入邮箱地址"
          />
        </Form.Item>

        <Form.Item
          name="phone"
          label="手机号码"
          rules={formRules.phone}
        >
          <Input
            prefix={<PhoneOutlined />}
            placeholder="请输入手机号码（可选）"
          />
        </Form.Item>

        {mode === 'create' && (
          <Form.Item
            name="password"
            label="组用户密码"
            rules={formRules.password}
          >
            <Input.Password
              placeholder="请输入组用户的LDAP密码"
            />
          </Form.Item>
        )}

        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onCancel}>
              取消
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={mode === 'create' ? <UserAddOutlined /> : undefined}
            >
              {mode === 'create' ? '提交申请' : '保存修改'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default StudentForm;