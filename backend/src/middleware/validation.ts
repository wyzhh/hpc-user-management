import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// 通用验证中间件
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // 显示所有验证错误
      stripUnknown: true, // 移除未知字段
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: '请求数据验证失败',
        code: 400,
        errors,
      });
    }

    // 将验证后的数据替换原始数据
    req.body = value;
    next();
  };
};

// 查询参数验证中间件
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: '查询参数验证失败',
        code: 400,
        errors,
      });
    }

    req.query = value;
    next();
  };
};

// 路径参数验证中间件
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: '路径参数验证失败',
        code: 400,
        errors,
      });
    }

    req.params = value;
    next();
  };
};

// 登录验证模式
export const loginSchema = Joi.object({
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': '用户名只能包含字母、数字、下划线和连字符',
      'string.min': '用户名至少需要3个字符',
      'string.max': '用户名不能超过50个字符',
      'any.required': '用户名是必填项',
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': '密码是必填项',
    }),
});

// 创建学生申请验证模式
export const createStudentSchema = Joi.object({
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': '用户名只能包含字母、数字、下划线和连字符',
      'string.min': '用户名至少需要3个字符',
      'string.max': '用户名不能超过50个字符',
      'any.required': '用户名是必填项',
    }),
  chinese_name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': '中文姓名至少需要2个字符',
      'string.max': '中文姓名不能超过50个字符',
      'any.required': '中文姓名是必填项',
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': '请提供有效的邮箱地址',
      'any.required': '邮箱是必填项',
    }),
  phone: Joi.string()
    .pattern(/^1[3-9]\d{9}$/)
    .allow('')
    .messages({
      'string.pattern.base': '请提供有效的手机号码',
    }),
  reason: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': '申请原因至少需要10个字符',
      'string.max': '申请原因不能超过500个字符',
      'any.required': '申请原因是必填项',
    }),
});

// 删除学生申请验证模式
export const deleteStudentSchema = Joi.object({
  student_id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': '学生ID必须是数字',
      'number.integer': '学生ID必须是整数',
      'number.positive': '学生ID必须是正数',
      'any.required': '学生ID是必填项',
    }),
  reason: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': '删除原因至少需要10个字符',
      'string.max': '删除原因不能超过500个字符',
      'any.required': '删除原因是必填项',
    }),
});

// 审批申请验证模式
export const approveRequestSchema = Joi.object({
  reason: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': '审批意见不能超过500个字符',
    }),
});

export const rejectRequestSchema = Joi.object({
  reason: Joi.string()
    .min(5)
    .max(500)
    .required()
    .messages({
      'string.min': '拒绝原因至少需要5个字符',
      'string.max': '拒绝原因不能超过500个字符',
      'any.required': '拒绝原因是必填项',
    }),
});

// 分页查询验证模式
export const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': '页码必须是数字',
      'number.integer': '页码必须是整数',
      'number.min': '页码必须大于0',
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.base': '每页数量必须是数字',
      'number.integer': '每页数量必须是整数',
      'number.min': '每页数量必须大于0',
      'number.max': '每页数量不能超过100',
    }),
  status: Joi.string()
    .valid('pending', 'active', 'deleted', 'approved', 'rejected')
    .allow('')
    .messages({
      'any.only': '状态值无效',
    }),
  type: Joi.string()
    .valid('create', 'delete')
    .allow('')
    .messages({
      'any.only': '类型值无效',
    }),
});

// ID参数验证模式
export const idParamSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'ID必须是数字',
      'number.integer': 'ID必须是整数',
      'number.positive': 'ID必须是正数',
      'any.required': 'ID是必填项',
    }),
});

// 用户名参数验证模式
export const usernameParamSchema = Joi.object({
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': '用户名只能包含字母、数字、下划线和连字符',
      'string.min': '用户名至少需要3个字符',
      'string.max': '用户名不能超过50个字符',
      'any.required': '用户名是必填项',
    }),
});