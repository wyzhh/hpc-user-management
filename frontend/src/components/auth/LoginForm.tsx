import React, { useState } from 'react';
import { Form, Input, Button, Card, Tabs, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const { TabPane } = Tabs;

interface LoginFormData {
  username: string;
  password: string;
}

const LoginForm: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pi' | 'admin'>('pi');
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 获取登录成功后的重定向路径
  const getRedirectPath = (userType: 'pi' | 'admin') => {
    const from = (location.state as any)?.from?.pathname;
    if (from && from !== '/login') {
      return from;
    }
    return userType === 'admin' ? '/admin/dashboard' : '/dashboard';
  };

  // 处理登录提交
  const handleSubmit = async (values: LoginFormData) => {
    setLoading(true);
    setError('');

    try {
      const success = await login(values, activeTab);
      
      if (success) {
        const redirectPath = getRedirectPath(activeTab);
        navigate(redirectPath, { replace: true });
      } else {
        setError('用户名或密码错误');
      }
    } catch (err) {
      setError('登录过程发生错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理标签页切换
  const handleTabChange = (key: string) => {
    setActiveTab(key as 'pi' | 'admin');
    setError('');
    form.resetFields();
  };

  const renderLoginForm = () => (
    <Form
      form={form}
      name="login"
      onFinish={handleSubmit}
      autoComplete="off"
      size="large"
    >
      <Form.Item
        name="username"
        rules={[
          { required: true, message: '请输入用户名' },
          { min: 3, message: '用户名至少3个字符' },
        ]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="用户名"
          autoComplete="username"
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="密码"
          autoComplete="current-password"
        />
      </Form.Item>

      {error && (
        <Form.Item>
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </Form.Item>
      )}

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          block
          icon={<LoginOutlined />}
        >
          {loading ? '登录中...' : '登录'}
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}
        bodyStyle={{ padding: '32px' }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ 
              margin: 0, 
              color: '#1890ff',
              fontSize: '24px',
              fontWeight: 'bold',
            }}>
              HPC用户管理系统
            </h1>
            <p style={{ 
              margin: '8px 0 0 0', 
              color: '#666',
              fontSize: '14px',
            }}>
              High Performance Computing User Management
            </p>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            centered
            items={[
              {
                key: 'pi',
                label: 'PI用户登录',
                children: renderLoginForm(),
              },
              {
                key: 'admin',
                label: '管理员登录',
                children: renderLoginForm(),
              },
            ]}
          />

          <div style={{ 
            textAlign: 'center', 
            fontSize: '12px', 
            color: '#999',
            borderTop: '1px solid #f0f0f0',
            paddingTop: '16px',
          }}>
            {activeTab === 'pi' 
              ? '如果您是PI（主要研究者），请使用此选项登录'
              : '如果您是系统管理员，请使用此选项登录'
            }
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default LoginForm;