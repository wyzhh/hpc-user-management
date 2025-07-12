import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Tag, Descriptions, message, Select, Switch } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined, SaveOutlined, KeyOutlined } from '@ant-design/icons';
import { PIUser, AdminUser, StudentUser, CreateAdminRequest, UpdateUserRequest, userService } from '../../services/user';

const { Option } = Select;

interface UserModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  user?: PIUser | AdminUser | StudentUser | null;
  mode: 'view' | 'edit' | 'create';
  userType: 'pi' | 'admin' | 'student';
}

const UserModal: React.FC<UserModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  user,
  mode,
  userType
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // 重置表单
  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && user) {
        const formData: any = {
          username: user.username,
          email: user.email,
        };

        if (userType === 'student') {
          formData.chinese_name = (user as StudentUser).chinese_name;
          formData.phone = (user as StudentUser).phone;
          formData.status = (user as StudentUser).status;
        } else {
          formData.full_name = (user as PIUser | AdminUser).full_name;
          formData.is_active = (user as PIUser | AdminUser).is_active;
          
          if (userType === 'pi') {
            formData.department = (user as PIUser).department;
            formData.phone = (user as PIUser).phone;
          } else if (userType === 'admin') {
            formData.role = (user as AdminUser).role;
          }
        }

        form.setFieldsValue(formData);
      } else if (mode === 'create') {
        form.resetFields();
        form.setFieldsValue({
          role: 'admin',
          is_active: true,
        });
      }
    }
  }, [visible, mode, user, form, userType]);

  // 表单提交
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      if (mode === 'create' && userType === 'admin') {
        const createData: CreateAdminRequest = {
          username: values.username,
          full_name: values.full_name,
          email: values.email,
          password: values.password,
          role: values.role,
        };

        const response = await userService.createAdminUser(createData);
        if (response.success) {
          message.success('管理员创建成功');
          onSuccess();
        } else {
          message.error('创建管理员失败: ' + response.message);
        }
      } else if (mode === 'edit' && user) {
        const updateData: UpdateUserRequest = {
          full_name: values.full_name,
          email: values.email,
          is_active: values.is_active,
        };

        if (userType === 'pi') {
          updateData.department = values.department;
          updateData.phone = values.phone;
        }

        const response = userType === 'pi'
          ? await userService.updatePIUser(user.id, updateData)
          : await userService.updateAdminUser(user.id, updateData);

        if (response.success) {
          message.success('用户信息更新成功');
          onSuccess();
        } else {
          message.error('更新用户信息失败: ' + response.message);
        }
      }
    } catch (error) {
      message.error('操作失败');
      console.error('Submit form error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    if (!user || userType !== 'admin') return;
    
    try {
      const newPassword = Math.random().toString(36).slice(-12);
      const response = await userService.resetAdminPassword(user.id, newPassword);
      
      if (response.success) {
        message.success(`密码重置成功！新密码：${newPassword}`);
        setPasswordVisible(true);
      } else {
        message.error('重置密码失败: ' + response.message);
      }
    } catch (error) {
      message.error('重置密码失败');
      console.error('Reset password error:', error);
    }
  };

  // 表单验证规则
  const formRules = {
    username: [
      { required: true, message: '请输入用户名' },
      { min: 3, message: '用户名至少需要3个字符' },
      { max: 50, message: '用户名不能超过50个字符' },
      { pattern: /^[a-zA-Z0-9]+$/, message: '用户名只能包含字母和数字' },
    ],
    full_name: [
      { required: true, message: '请输入姓名' },
      { min: 2, message: '姓名至少需要2个字符' },
      { max: 50, message: '姓名不能超过50个字符' }
    ],
    email: [
      { required: true, message: '请输入邮箱地址' },
      { type: 'email' as const, message: '邮箱格式不正确' }
    ],
    phone: [
      { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
    ],
    password: mode === 'create' ? [
      { required: true, message: '请输入密码' },
      { min: 8, message: '密码至少需要8个字符' },
      { pattern: /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: '密码必须包含大小写字母和数字' }
    ] : [],
    role: [
      { required: true, message: '请选择角色' }
    ]
  };

  const getTitle = () => {
    const userTypeName = userType === 'pi' ? 'PI用户' : userType === 'admin' ? '管理员' : '学生';
    if (mode === 'view') return `查看${userTypeName}`;
    if (mode === 'edit') return `编辑${userTypeName}`;
    if (mode === 'create') return `添加${userTypeName}`;
    return '';
  };

  const isReadonly = mode === 'view' || userType === 'student';

  return (
    <Modal
      title={getTitle()}
      open={visible}
      onCancel={onCancel}
      footer={
        mode === 'view' ? [
          <Button key="close" onClick={onCancel}>
            关闭
          </Button>,
          ...(userType === 'admin' && user && !(user as AdminUser).ldap_dn ? [
            <Button 
              key="reset" 
              icon={<KeyOutlined />}
              onClick={handleResetPassword}
            >
              重置密码
            </Button>
          ] : [])
        ] : [
          <Button key="cancel" onClick={onCancel}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={loading}
            icon={<SaveOutlined />}
            onClick={() => form.submit()}
          >
            {mode === 'create' ? '创建' : '保存'}
          </Button>,
        ]
      }
      width={700}
      destroyOnClose
    >
      {mode === 'view' && user ? (
        // 查看模式 - 显示详细信息
        <div>
          <Descriptions title="基本信息" column={2} bordered size="small">
            <Descriptions.Item label="用户ID">{user.id}</Descriptions.Item>
            <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
            <Descriptions.Item label={userType === 'student' ? '中文姓名' : '姓名'}>
              {userType === 'student' ? (user as StudentUser).chinese_name : (user as PIUser | AdminUser).full_name}
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
            
            {userType === 'pi' && (
              <>
                <Descriptions.Item label="部门">{(user as PIUser).department || '-'}</Descriptions.Item>
                <Descriptions.Item label="手机号">{(user as PIUser).phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="学生数量">
                  <Tag color="green">{(user as PIUser).student_count || 0}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="LDAP DN">{(user as PIUser).ldap_dn}</Descriptions.Item>
              </>
            )}
            
            {userType === 'admin' && (
              <>
                <Descriptions.Item label="角色">
                  <Tag color={userService.getRoleColor((user as AdminUser).role)}>
                    {userService.getRoleText((user as AdminUser).role)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="认证方式">
                  <Tag color={(user as AdminUser).ldap_dn ? 'blue' : 'green'}>
                    {(user as AdminUser).ldap_dn ? 'LDAP' : '本地密码'}
                  </Tag>
                </Descriptions.Item>
                {(user as AdminUser).ldap_dn && (
                  <Descriptions.Item label="LDAP DN" span={2}>
                    {(user as AdminUser).ldap_dn}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="最后登录">
                  {(user as AdminUser).last_login 
                    ? userService.formatTime((user as AdminUser).last_login!)
                    : '从未登录'
                  }
                </Descriptions.Item>
              </>
            )}

            {userType === 'student' && (
              <>
                <Descriptions.Item label="手机号">{(user as StudentUser).phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="导师">
                  <div>
                    <div style={{ fontWeight: 500 }}>{(user as StudentUser).pi_name || '-'}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {(user as StudentUser).pi_username || '-'}
                    </div>
                  </div>
                </Descriptions.Item>
                {(user as StudentUser).ldap_dn && (
                  <Descriptions.Item label="LDAP DN" span={2}>
                    {(user as StudentUser).ldap_dn}
                  </Descriptions.Item>
                )}
              </>
            )}
            
            <Descriptions.Item label="状态">
              {userType === 'student' ? (
                <Tag color={userService.getStudentStatusColor((user as StudentUser).status)}>
                  {userService.getStudentStatusText((user as StudentUser).status)}
                </Tag>
              ) : (
                <Tag color={userService.getStatusColor((user as PIUser | AdminUser).is_active)}>
                  {userService.getStatusText((user as PIUser | AdminUser).is_active)}
                </Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {userService.formatTime(user.created_at)}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {userService.formatTime(user.updated_at)}
            </Descriptions.Item>
          </Descriptions>
        </div>
      ) : (
        // 编辑/创建模式 - 显示表单
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
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              disabled={mode === 'edit' || isReadonly}
            />
          </Form.Item>

          <Form.Item
            name="full_name"
            label="姓名"
            rules={formRules.full_name}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入姓名"
              disabled={isReadonly}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={formRules.email}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入邮箱地址"
              disabled={isReadonly}
            />
          </Form.Item>

          {userType === 'pi' && (
            <>
              <Form.Item
                name="department"
                label="部门"
              >
                <Input
                  placeholder="请输入部门"
                  disabled={isReadonly}
                />
              </Form.Item>

              <Form.Item
                name="phone"
                label="手机号"
                rules={formRules.phone}
              >
                <Input
                  prefix={<PhoneOutlined />}
                  placeholder="请输入手机号码（可选）"
                  disabled={isReadonly}
                />
              </Form.Item>
            </>
          )}

          {userType === 'admin' && (
            <>
              <Form.Item
                name="role"
                label="角色"
                rules={formRules.role}
              >
                <Select
                  placeholder="请选择角色"
                  disabled={isReadonly}
                >
                  {userService.getAdminRoleOptions().map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {mode === 'create' && (
                <Form.Item
                  name="password"
                  label="密码"
                  rules={formRules.password}
                >
                  <Input.Password
                    placeholder="请输入密码"
                    disabled={isReadonly}
                  />
                </Form.Item>
              )}
            </>
          )}

          {mode === 'edit' && (
            <Form.Item
              name="is_active"
              label="状态"
              valuePropName="checked"
            >
              <Switch
                checkedChildren="活跃"
                unCheckedChildren="停用"
                disabled={isReadonly}
              />
            </Form.Item>
          )}
        </Form>
      )}
    </Modal>
  );
};

export default UserModal;