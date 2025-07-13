import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { roleAssignmentService } from '../../services/roleAssignment';
import { User } from '../../types';

interface UserEditModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  user: User | null;
}

const UserEditModal: React.FC<UserEditModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  user
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 初始化表单数据
  useEffect(() => {
    if (visible && user) {
      form.setFieldsValue({
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        is_active: user.is_active
      });
    }
  }, [visible, user, form]);

  // 提交表单
  const handleSubmit = async (values: any) => {
    if (!user) return;

    setLoading(true);
    try {
      const updateData = {
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        is_active: values.is_active
      };

      const response = await roleAssignmentService.updateUser(user.id, updateData);
      
      if (response.success) {
        message.success('用户信息更新成功');
        onSuccess();
      } else {
        message.error('更新用户信息失败: ' + response.message);
      }
    } catch (error) {
      message.error('更新用户信息失败');
      console.error('Update user error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 取消操作
  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="编辑用户信息"
      open={visible}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="保存"
      cancelText="取消"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="用户名"
          name="username"
        >
          <Input disabled value={user?.username} />
        </Form.Item>

        <Form.Item
          label="姓名"
          name="full_name"
          rules={[
            { required: true, message: '请输入姓名' },
            { max: 100, message: '姓名不能超过100个字符' }
          ]}
        >
          <Input placeholder="请输入姓名" />
        </Form.Item>

        <Form.Item
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}
        >
          <Input placeholder="请输入邮箱" />
        </Form.Item>

        <Form.Item
          label="电话"
          name="phone"
          rules={[
            { max: 20, message: '电话号码不能超过20个字符' }
          ]}
        >
          <Input placeholder="请输入电话号码" />
        </Form.Item>

        <Form.Item
          label="用户类型"
          name="user_type"
        >
          <Input disabled value={user?.user_type} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default UserEditModal;