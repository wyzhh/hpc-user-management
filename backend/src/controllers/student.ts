import { Request, Response } from 'express';
import { StudentModel, RequestModel } from '../models';
import { ldapService } from '../services/ldap';
import { AuditService } from '../services/audit';
import { CreateStudentRequest, DeleteStudentRequest } from '../types';

export class StudentController {
  static async getMyStudents(req: Request, res: Response) {
    try {
      const piId = req.userId!;
      const { page = 1, limit = 10, status } = req.query as any;

      const result = await StudentModel.findByPiId(
        piId,
        parseInt(page),
        parseInt(limit),
        status
      );

      res.json({
        success: true,
        message: '获取学生列表成功',
        code: 200,
        data: result,
      });
    } catch (error) {
      console.error('获取学生列表错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  static async getStudentById(req: Request, res: Response) {
    try {
      const studentId = parseInt(req.params.id);
      const piId = req.userId!;

      // 检查学生是否属于当前PI
      const hasOwnership = await StudentModel.checkOwnership(studentId, piId);
      if (!hasOwnership) {
        return res.status(403).json({
          success: false,
          message: '您没有权限查看此学生信息',
          code: 403,
        });
      }

      const student = await StudentModel.findById(studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: '学生不存在',
          code: 404,
        });
      }

      res.json({
        success: true,
        message: '获取学生信息成功',
        code: 200,
        data: student,
      });
    } catch (error) {
      console.error('获取学生信息错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  static async createStudentRequest(req: Request, res: Response) {
    try {
      const piId = req.userId!;
      const studentData: CreateStudentRequest = req.body;

      // 检查用户名是否已存在（数据库）
      const existingStudent = await StudentModel.findByUsername(studentData.username);
      if (existingStudent) {
        return res.status(409).json({
          success: false,
          message: '用户名已存在',
          code: 409,
        });
      }

      // 检查用户名是否已存在（LDAP）
      const ldapExists = await ldapService.checkUserExists(studentData.username, false);
      if (ldapExists) {
        return res.status(409).json({
          success: false,
          message: '用户名在LDAP中已存在',
          code: 409,
        });
      }

      // 创建申请记录
      const request = await RequestModel.create({
        pi_id: piId,
        request_type: 'create',
        student_data: studentData,
        status: 'pending',
        reason: studentData.reason,
      });

      // 记录审计日志
      await AuditService.logRequestCreated(request.id, piId, 'create', {
        student_username: studentData.username,
        student_chinese_name: studentData.chinese_name,
        student_email: studentData.email,
      });

      res.status(201).json({
        success: true,
        message: '学生创建申请已提交，等待管理员审核',
        code: 201,
        data: {
          request_id: request.id,
          status: request.status,
        },
      });
    } catch (error) {
      console.error('创建学生申请错误:', error);
      
      // 记录错误日志
      await AuditService.logError(
        'create_student_request',
        'pi',
        req.userId!,
        error as Error,
        { student_data: req.body }
      );

      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  static async deleteStudentRequest(req: Request, res: Response) {
    try {
      const piId = req.userId!;
      const { student_id, reason }: DeleteStudentRequest = req.body;

      // 检查学生是否存在且属于当前PI
      const student = await StudentModel.findById(student_id);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: '学生不存在',
          code: 404,
        });
      }

      if (student.pi_id !== piId) {
        return res.status(403).json({
          success: false,
          message: '您只能删除自己创建的学生账号',
          code: 403,
        });
      }

      if (student.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: '只能删除状态为活跃的学生账号',
          code: 400,
        });
      }

      // 检查是否已有待处理的删除申请
      const existingRequests = await RequestModel.findByPiId(piId, 1, 10, 'pending', 'delete');
      const hasExistingRequest = existingRequests.requests.some(req => req.student_id === student_id);
      
      if (hasExistingRequest) {
        return res.status(409).json({
          success: false,
          message: '该学生已有待处理的删除申请',
          code: 409,
        });
      }

      // 创建删除申请记录
      const request = await RequestModel.create({
        pi_id: piId,
        request_type: 'delete',
        student_id: student_id,
        status: 'pending',
        reason: reason,
      });

      // 记录审计日志
      await AuditService.logRequestCreated(request.id, piId, 'delete', {
        student_id: student_id,
        student_username: student.username,
        student_chinese_name: student.chinese_name,
      });

      res.status(201).json({
        success: true,
        message: '学生删除申请已提交，等待管理员审核',
        code: 201,
        data: {
          request_id: request.id,
          status: request.status,
        },
      });
    } catch (error) {
      console.error('删除学生申请错误:', error);
      
      // 记录错误日志
      await AuditService.logError(
        'delete_student_request',
        'pi',
        req.userId!,
        error as Error,
        { request_data: req.body }
      );

      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  static async checkUsernameAvailability(req: Request, res: Response) {
    try {
      const { username } = req.params;

      // 检查数据库中是否存在
      const dbExists = await StudentModel.findByUsername(username);
      
      // 检查LDAP中是否存在
      const ldapExists = await ldapService.checkUserExists(username, false);

      const available = !dbExists && !ldapExists;

      res.json({
        success: true,
        message: '用户名可用性检查完成',
        code: 200,
        data: {
          username,
          available,
          reason: !available 
            ? (dbExists ? '用户名在数据库中已存在' : 'LDAP中已存在该用户名')
            : '用户名可用',
        },
      });
    } catch (error) {
      console.error('检查用户名可用性错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }
}