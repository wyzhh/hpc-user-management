import { Request, Response } from 'express';
import { RequestModel, StudentModel } from '../models';
import { ldapService } from '../services/ldap';
import { AuditService } from '../services/audit';

export class RequestController {
  // PI查看自己的申请记录
  static async getMyRequests(req: Request, res: Response) {
    try {
      const piId = req.userId!;
      const { page = 1, limit = 10, status, type } = req.query as any;

      const result = await RequestModel.findByPiId(
        piId,
        parseInt(page),
        parseInt(limit),
        status,
        type
      );

      res.json({
        success: true,
        message: '获取申请记录成功',
        code: 200,
        data: result,
      });
    } catch (error) {
      console.error('获取申请记录错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  // 管理员查看所有申请记录
  static async getAllRequests(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, status, pi_id } = req.query as any;

      const result = await RequestModel.getAll(
        parseInt(page),
        parseInt(limit),
        status,
        pi_id ? parseInt(pi_id) : undefined
      );

      res.json({
        success: true,
        message: '获取申请记录成功',
        code: 200,
        data: result,
      });
    } catch (error) {
      console.error('获取申请记录错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  // 获取申请详情
  static async getRequestById(req: Request, res: Response) {
    try {
      const requestId = parseInt(req.params.id);
      const request = await RequestModel.findById(requestId);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: '申请记录不存在',
          code: 404,
        });
      }

      // 如果是PI用户，检查是否是自己的申请
      if (req.userRole === 'pi' && request.pi_id !== req.userId) {
        return res.status(403).json({
          success: false,
          message: '您只能查看自己的申请记录',
          code: 403,
        });
      }

      // 获取审计轨迹
      const auditTrail = await AuditService.getRequestAuditTrail(requestId);

      res.json({
        success: true,
        message: '获取申请详情成功',
        code: 200,
        data: {
          request,
          audit_trail: auditTrail,
        },
      });
    } catch (error) {
      console.error('获取申请详情错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  // 管理员批准申请
  static async approveRequest(req: Request, res: Response) {
    const requestId = parseInt(req.params.id);
    const adminId = req.userId!;
    
    try {
      const { reason } = req.body;

      const request = await RequestModel.findById(requestId);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: '申请记录不存在',
          code: 404,
        });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '只能审批待处理状态的申请',
          code: 400,
        });
      }

      try {
        let student = null;

        if (request.request_type === 'create') {
          // 处理创建学生账号申请
          const studentData = request.student_data;
          
          // 再次检查用户名是否可用
          const existingStudent = await StudentModel.findByUsername(studentData.username);
          if (existingStudent) {
            return res.status(409).json({
              success: false,
              message: '用户名已被占用，无法创建',
              code: 409,
            });
          }

          // 在LDAP中创建账号
          const ldapDn = await ldapService.createStudentAccount(studentData, request.pi_id);

          // 在数据库中创建学生记录
          student = await StudentModel.create({
            username: studentData.username,
            chinese_name: studentData.chinese_name,
            email: studentData.email,
            phone: studentData.phone,
            pi_id: request.pi_id,
            ldap_dn: ldapDn,
            status: 'active',
          });

          // 记录LDAP账号创建日志
          await AuditService.logLdapAccountCreated(
            requestId,
            studentData.username,
            ldapDn,
            { admin_id: adminId }
          );

        } else if (request.request_type === 'delete') {
          // 处理删除学生账号申请
          student = await StudentModel.findById(request.student_id!);
          if (!student) {
            return res.status(404).json({
              success: false,
              message: '要删除的学生不存在',
              code: 404,
            });
          }

          // 从LDAP中删除账号
          const ldapDeleted = await ldapService.deleteStudentAccount(student.username);
          if (!ldapDeleted) {
            throw new Error('LDAP账号删除失败');
          }

          // 更新数据库中的学生状态
          await StudentModel.update(student.id, { status: 'deleted' });

          // 记录LDAP账号删除日志
          await AuditService.logLdapAccountDeleted(
            requestId,
            student.username,
            student.ldap_dn || '',
            { admin_id: adminId }
          );
        }

        // 更新申请状态
        await RequestModel.update(requestId, {
          status: 'approved',
          admin_id: adminId,
          reason: reason || '',
        });

        // 记录审批日志
        await AuditService.logRequestApproved(requestId, adminId, {
          request_type: request.request_type,
          student_id: student?.id,
          reason: reason || '',
        });

        res.json({
          success: true,
          message: '申请已批准并执行成功',
          code: 200,
          data: {
            request_id: requestId,
            status: 'approved',
            ...(student && { student_id: student.id }),
          },
        });

      } catch (ldapError) {
        console.error('LDAP操作失败:', ldapError);
        
        // 记录错误日志
        await AuditService.logError(
          'approve_request',
          'admin',
          adminId,
          ldapError as Error,
          { request_id: requestId, request_type: request.request_type },
          requestId
        );

        // LDAP操作失败，但不更新申请状态，让管理员手动处理
        return res.status(500).json({
          success: false,
          message: `LDAP操作失败: ${(ldapError as Error).message}`,
          code: 500,
        });
      }

    } catch (error) {
      console.error('批准申请错误:', error);
      
      await AuditService.logError(
        'approve_request',
        'admin',
        req.userId!,
        error as Error,
        { request_id: requestId },
        requestId
      );

      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  // 管理员拒绝申请
  static async rejectRequest(req: Request, res: Response) {
    const requestId = parseInt(req.params.id);
    const adminId = req.userId!;
    
    try {
      const { reason } = req.body;

      const request = await RequestModel.findById(requestId);
      if (!request) {
        return res.status(404).json({
          success: false,
          message: '申请记录不存在',
          code: 404,
        });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: '只能审批待处理状态的申请',
          code: 400,
        });
      }

      // 更新申请状态
      await RequestModel.update(requestId, {
        status: 'rejected',
        admin_id: adminId,
        reason: reason,
      });

      // 记录拒绝日志
      await AuditService.logRequestRejected(requestId, adminId, reason, {
        request_type: request.request_type,
      });

      res.json({
        success: true,
        message: '申请已拒绝',
        code: 200,
        data: {
          request_id: requestId,
          status: 'rejected',
          reason: reason,
        },
      });

    } catch (error) {
      console.error('拒绝申请错误:', error);
      
      await AuditService.logError(
        'reject_request',
        'admin',
        req.userId!,
        error as Error,
        { request_id: requestId, reason: req.body.reason },
        requestId
      );

      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }

  // 获取申请统计信息
  static async getRequestStats(req: Request, res: Response) {
    try {
      let piId: number | undefined;
      
      // 如果是PI用户，只统计自己的申请
      if (req.userRole === 'pi') {
        piId = req.userId!;
      }

      // 获取各状态的申请数量
      const [pending, approved, rejected] = await Promise.all([
        RequestModel.getAll(1, 1, 'pending', piId),
        RequestModel.getAll(1, 1, 'approved', piId),
        RequestModel.getAll(1, 1, 'rejected', piId),
      ]);

      res.json({
        success: true,
        message: '获取申请统计成功',
        code: 200,
        data: {
          pending: pending.total,
          approved: approved.total,
          rejected: rejected.total,
          total: pending.total + approved.total + rejected.total,
        },
      });

    } catch (error) {
      console.error('获取申请统计错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 500,
      });
    }
  }
}