import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Radio, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Paragraph } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
  userType: 'pi' | 'admin';
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 获取登录后的重定向路径
  const getRedirectPath = (userType: 'pi' | 'admin') => {
    const from = (location.state as any)?.from?.pathname;
    
    // 如果有重定向路径，检查用户是否有权限访问
    if (from && from !== '/login') {
      // 管理员可以访问所有页面
      if (userType === 'admin') {
        return from;
      }
      // PI用户只能访问非管理员页面
      if (userType === 'pi' && !from.startsWith('/admin/')) {
        return from;
      }
    }
    
    // 默认重定向
    return '/dashboard';
  };

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    setError('');

    try {
      const result = await login(values.username, values.password, values.userType);
      
      if (result.success) {
        const redirectPath = getRedirectPath(values.userType);
        navigate(redirectPath, { replace: true });
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('登录过程中发生错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

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
          width: 400,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              HPC用户管理系统
            </Title>
            <Paragraph type="secondary">
              高性能计算中心用户管理平台
            </Paragraph>
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError('')}
            />
          )}

          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
            initialValues={{ userType: 'pi' }}
          >
            <Form.Item
              name="userType"
              rules={[{ required: true, message: '请选择用户类型' }]}
            >
              <Radio.Group buttonStyle="solid">
                <Radio.Button value="pi">PI用户</Radio.Button>
                <Radio.Button value="admin">管理员</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { pattern: /^[a-zA-Z0-9_-]+$/, message: '用户名只能包含字母、数字、下划线和连字符' },
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

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ width: '100%' }}
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          <div style={{ fontSize: '12px', color: '#999' }}>
            <Paragraph type="secondary">
              <details>
                <summary style={{ cursor: 'pointer', color: '#1890ff' }}>
                  测试账号 (点击展开)
                </summary>
                <div style={{ marginTop: '8px', lineHeight: '1.4' }}>
                  <strong>管理员账号：</strong><br />
                  zhang_wei / zhang123 (超级管理员)<br />
                  li_ming / li123 (普通管理员)<br /><br />
                  
                  <strong>普通用户账号：</strong><br />
                  wang_lei / wang123<br />
                  chen_hao / chen123<br />
                  liu_hua / liu123<br />
                  zhao_qiang / zhao123<br />
                  sun_min / sun123<br />
                  zhou_jie / zhou123<br />
                  wu_yan / wu123<br />
                  xu_gang / xu123<br />
                  user_a / usera123<br />
                  researcher01 / researcher123<br />
                  john_smith / john123<br />
                  test123 / test123
                </div>
              </details>
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default Login;