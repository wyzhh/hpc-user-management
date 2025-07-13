import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Alert, Modal, Table, Space, Typography, Steps } from 'antd';
import { SearchOutlined, UserOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

interface InitializationStatus {
  isInitialized: boolean;
  databaseExists: boolean;
  hasAdminUsers: boolean;
  message: string;
}

interface LDAPUser {
  username: string;
  full_name: string;
  email: string;
  uid_number?: number;
  ldap_dn: string;
}

interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  auth_type: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  uid_number?: number;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const InitializationPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initStatus, setInitStatus] = useState<InitializationStatus | null>(null);
  const [ldapUsers, setLdapUsers] = useState<LDAPUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<LDAPUser | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 检查初始化状态
  const checkInitializationStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/initialization/status`);
      const status = response.data.data;
      setInitStatus(status);

      if (status.isInitialized) {
        setCurrentStep(3); // 已完成初始化
      } else if (status.databaseExists && !status.hasAdminUsers) {
        setCurrentStep(1); // 需要设置管理员
      } else if (!status.databaseExists) {
        setCurrentStep(0); // 需要创建数据库
      }

      // 如果已有管理员，加载管理员列表
      if (status.hasAdminUsers) {
        await loadAdminUsers();
      }

      // 如果需要设置管理员，加载LDAP用户列表
      if (!status.hasAdminUsers && status.databaseExists) {
        await loadLDAPUsers();
      }
    } catch (error) {
      console.error('检查初始化状态失败:', error);
      setError('无法检查系统状态，请确认后端服务已启动');
    } finally {
      setLoading(false);
    }
  };

  // 创建数据库表
  const createTables = async () => {
    try {
      setLoading(true);
      setError(null);
      await axios.post(`${API_BASE_URL}/initialization/create-tables`);
      setSuccess('数据库表创建成功');
      setCurrentStep(1);
      await checkInitializationStatus();
      // 创建完成后加载LDAP用户
      await loadLDAPUsers();
    } catch (error: any) {
      console.error('创建数据库表失败:', error);
      setError(error.response?.data?.message || '创建数据库表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载所有LDAP用户
  const loadLDAPUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/initialization/ldap-users`);
      setLdapUsers(response.data.data);
      console.log(`加载了 ${response.data.data.length} 个LDAP用户`);
    } catch (error: any) {
      console.error('加载LDAP用户失败:', error);
      setError(error.response?.data?.message || '加载LDAP用户失败');
      setLdapUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // 设置管理员用户
  const setAdminUser = async (user: LDAPUser) => {
    try {
      console.log('开始设置管理员用户:', user);
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/initialization/set-admin`, {
        username: user.username
      });
      
      console.log('设置管理员API响应:', response.data);
      setSuccess(`成功设置 ${user.full_name} 为管理员`);
      setSelectedUser(user);
      setCurrentStep(2);
      await loadAdminUsers();
      await checkInitializationStatus();
    } catch (error: any) {
      console.error('设置管理员失败:', error);
      setError(error.response?.data?.message || '设置管理员失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载管理员列表
  const loadAdminUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/initialization/admin-users`);
      setAdminUsers(response.data.data);
    } catch (error) {
      console.error('加载管理员列表失败:', error);
    }
  };

  // 完成初始化
  const completeInitialization = async () => {
    try {
      setLoading(true);
      setError(null);
      await axios.post(`${API_BASE_URL}/initialization/complete`);
      setSuccess('系统初始化完成！');
      setCurrentStep(3);
      window.location.href = '/admin';
    } catch (error: any) {
      console.error('完成初始化失败:', error);
      setError(error.response?.data?.message || '完成初始化失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkInitializationStatus();
  }, []);

  const steps = [
    {
      title: '创建数据库',
      description: '初始化数据库表结构'
    },
    {
      title: '设置管理员',
      description: '从LDAP中选择管理员用户'
    },
    {
      title: '确认设置',
      description: '确认管理员设置并完成初始化'
    },
    {
      title: '初始化完成',
      description: '系统已准备就绪'
    }
  ];

  const ldapUserColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'UID',
      dataIndex: 'uid_number',
      key: 'uid_number',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: LDAPUser) => (
        <Button 
          type="primary" 
          size="small" 
          onClick={() => {
            console.log('点击设为管理员按钮:', record);
            const confirmed = window.confirm(`确定要将 ${record.full_name} (${record.username}) 设置为系统管理员吗？`);
            if (confirmed) {
              console.log('确认设置管理员:', record);
              setAdminUser(record);
            } else {
              console.log('取消设置管理员');
            }
          }}
        >
          设为管理员
        </Button>
      ),
    },
  ];

  const adminUserColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: '认证方式',
      dataIndex: 'auth_type',
      key: 'auth_type',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
  ];

  if (loading && !initStatus) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <LoadingOutlined style={{ fontSize: 48, marginBottom: 16 }} />
        <Text>正在检查系统状态...</Text>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <Card>
        <Title level={2} style={{ textAlign: 'center', marginBottom: 32 }}>
          HPC用户管理系统初始化
        </Title>

        <Steps current={currentStep} style={{ marginBottom: 32 }}>
          {steps.map((step, index) => (
            <Steps.Step
              key={index}
              title={step.title}
              description={step.description}
              icon={currentStep > index ? <CheckCircleOutlined /> : undefined}
            />
          ))}
        </Steps>

        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setError(null)}
          />
        )}

        {success && (
          <Alert
            message="成功"
            description={success}
            type="success"
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setSuccess(null)}
          />
        )}

        {initStatus && (
          <Alert
            message="系统状态"
            description={initStatus.message}
            type={initStatus.isInitialized ? 'success' : 'info'}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* 步骤0: 创建数据库 */}
        {currentStep === 0 && (
          <Card title="第一步：创建数据库表" style={{ marginBottom: 16 }}>
            <Paragraph>
              系统检测到数据库表尚未创建。请点击下方按钮初始化数据库表结构。
            </Paragraph>
            <Button 
              type="primary" 
              size="large" 
              loading={loading}
              onClick={createTables}
            >
              创建数据库表
            </Button>
          </Card>
        )}

        {/* 步骤1: 选择管理员 */}
        {currentStep === 1 && (
          <Card title="第二步：设置系统管理员" style={{ marginBottom: 16 }}>
            <Paragraph>
              请从下方的LDAP用户列表中选择一个用户作为系统管理员。该用户将拥有系统的完整管理权限。
            </Paragraph>
            
            {ldapUsers.length > 0 ? (
              <Table
                dataSource={ldapUsers}
                columns={ldapUserColumns}
                rowKey="username"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                size="small"
                loading={loading}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                {loading ? (
                  <>
                    <LoadingOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                    <div>正在加载LDAP用户...</div>
                  </>
                ) : (
                  <div>
                    <div>暂无LDAP用户数据</div>
                    <Button 
                      type="primary" 
                      onClick={loadLDAPUsers}
                      style={{ marginTop: 8 }}
                    >
                      重新加载
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* 步骤2: 确认管理员设置 */}
        {currentStep === 2 && (
          <Card title="第三步：确认管理员设置" style={{ marginBottom: 16 }}>
            <Paragraph>
              以下是当前系统中的管理员用户。确认无误后，请点击完成初始化。
            </Paragraph>
            
            {adminUsers.length > 0 && (
              <Table
                dataSource={adminUsers}
                columns={adminUserColumns}
                rowKey="id"
                pagination={false}
                size="small"
                style={{ marginBottom: 16 }}
              />
            )}

            <Button 
              type="primary" 
              size="large"
              loading={loading}
              onClick={completeInitialization}
            >
              完成初始化
            </Button>
          </Card>
        )}

        {/* 步骤3: 初始化完成 */}
        {currentStep === 3 && (
          <Card title="系统初始化完成" style={{ marginBottom: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <CheckCircleOutlined 
                style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} 
              />
              <Title level={3}>系统已完成初始化！</Title>
              <Paragraph>
                HPC用户管理系统已成功初始化并准备就绪。您现在可以使用管理员账户登录系统。
              </Paragraph>
              
              {adminUsers.length > 0 && (
                <>
                  <Title level={4}>管理员用户</Title>
                  <Table
                    dataSource={adminUsers}
                    columns={adminUserColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    style={{ marginBottom: 16 }}
                  />
                </>
              )}

              <Button 
                type="primary" 
                size="large"
                onClick={() => window.location.href = '/admin'}
              >
                进入管理系统
              </Button>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default InitializationPage;