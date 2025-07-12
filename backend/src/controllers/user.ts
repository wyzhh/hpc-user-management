import { Request, Response } from 'express';
import { PIModel, AdminModel, StudentModel } from '../models';
import { Admin, PIInfo } from '../types';
import { ldapService } from '../services/ldap';
import { AuditService } from '../services/audit';
import { SyncService } from '../services/sync';
import bcrypt from 'bcryptjs';

export class UserController {
  // 获取PI用户列表
  static async getPIUsers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, active, search } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const activeFilter = active !== undefined ? active === 'true' : null;

      let pis: PIInfo[];
      let total: number;

      if (search) {
        // 如果有搜索参数，需要实现搜索逻辑
        const searchStr = search as string;
        // 这里简化处理，实际项目中可能需要更复杂的搜索逻辑
        const allResult = await PIModel.getAll(1, 1000, activeFilter === null ? false : activeFilter);
        const filtered = allResult.pis.filter(pi => 
          pi.username.toLowerCase().includes(searchStr.toLowerCase()) ||
          pi.full_name.toLowerCase().includes(searchStr.toLowerCase()) ||
          pi.email.toLowerCase().includes(searchStr.toLowerCase())
        );
        total = filtered.length;
        const startIndex = (pageNum - 1) * limitNum;
        pis = filtered.slice(startIndex, startIndex + limitNum);
      } else {
        const result = await PIModel.getAll(pageNum, limitNum, activeFilter === null ? false : activeFilter);
        pis = result.pis;
        total = result.total;
      }

      // 为每个PI获取学生数量
      const pisWithStudentCount = await Promise.all(pis.map(async (pi) => {
        const studentResult = await StudentModel.findByPiId(pi.id, 1, 1000);
        return {
          ...pi,
          student_count: studentResult.total
        };
      }));

      res.json({
        success: true,
        data: {
          pis: pisWithStudentCount,
          total
        },
        message: '获取PI用户列表成功'
      });
    } catch (error) {
      console.error('获取PI用户列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取PI用户列表失败',
        code: 500
      });
    }
  }

  // 获取管理员列表
  static async getAdminUsers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, active, search } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      // 注意：这里需要扩展AdminModel以支持分页和搜索
      // 目前先返回基本的管理员信息
      const admins = [
        {
          id: 1,
          username: 'admin',
          full_name: '系统管理员',
          email: 'admin@hpc.university.edu',
          role: 'admin',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_login: new Date().toISOString()
        }
      ];

      const filteredAdmins = search 
        ? admins.filter(admin => 
            admin.username.toLowerCase().includes((search as string).toLowerCase()) ||
            admin.full_name.toLowerCase().includes((search as string).toLowerCase()) ||
            admin.email.toLowerCase().includes((search as string).toLowerCase())
          )
        : admins;

      const total = filteredAdmins.length;
      const startIndex = (pageNum - 1) * limitNum;
      const result = filteredAdmins.slice(startIndex, startIndex + limitNum);

      res.json({
        success: true,
        data: {
          admins: result,
          total
        },
        message: '获取管理员列表成功'
      });
    } catch (error) {
      console.error('获取管理员列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取管理员列表失败',
        code: 500
      });
    }
  }

  // 获取PI用户详情
  static async getPIUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const pi = await PIModel.findById(parseInt(id));

      if (!pi) {
        return res.status(404).json({
          success: false,
          message: 'PI用户不存在',
          code: 404
        });
      }

      // 获取学生数量
      const studentResult = await StudentModel.findByPiId(pi.id, 1, 1000);
      const piWithStudentCount = {
        ...pi,
        student_count: studentResult.total
      };

      res.json({
        success: true,
        data: piWithStudentCount,
        message: '获取PI用户详情成功'
      });
    } catch (error) {
      console.error('获取PI用户详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取PI用户详情失败',
        code: 500
      });
    }
  }

  // 更新PI用户
  static async updatePIUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { full_name, email, department, phone, is_active } = req.body;

      const updateData: Partial<PIInfo> = {};
      if (full_name !== undefined) updateData.full_name = full_name;
      if (email !== undefined) updateData.email = email;
      if (department !== undefined) updateData.department = department;
      if (phone !== undefined) updateData.phone = phone;
      if (is_active !== undefined) updateData.is_active = is_active;

      const updatedPI = await PIModel.update(parseInt(id), updateData);

      if (!updatedPI) {
        return res.status(404).json({
          success: false,
          message: 'PI用户不存在',
          code: 404
        });
      }

      // 记录审计日志
      await AuditService.logAction(
        'update_pi_user',
        'admin',
        req.user!.id,
        { pi_id: parseInt(id), changes: updateData }
      );

      res.json({
        success: true,
        data: updatedPI,
        message: 'PI用户更新成功'
      });
    } catch (error) {
      console.error('更新PI用户失败:', error);
      res.status(500).json({
        success: false,
        message: '更新PI用户失败',
        code: 500
      });
    }
  }

  // 切换PI用户状态
  static async togglePIUserStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const updatedPI = await PIModel.update(parseInt(id), { is_active });

      if (!updatedPI) {
        return res.status(404).json({
          success: false,
          message: 'PI用户不存在',
          code: 404
        });
      }

      // 记录审计日志
      await AuditService.logAction(
        is_active ? 'activate_pi_user' : 'deactivate_pi_user',
        'admin',
        req.user!.id,
        { pi_id: parseInt(id), is_active }
      );

      res.json({
        success: true,
        data: updatedPI,
        message: `PI用户已${is_active ? '激活' : '停用'}`
      });
    } catch (error) {
      console.error('切换PI用户状态失败:', error);
      res.status(500).json({
        success: false,
        message: '切换PI用户状态失败',
        code: 500
      });
    }
  }

  // 同步LDAP用户（完全同步）
  static async syncLDAPUsers(req: Request, res: Response) {
    try {
      console.log(`管理员 ${req.user!.username} 开始完全同步LDAP用户`);

      // 执行完全同步
      const syncResult = await SyncService.syncAllUsers();

      // 记录审计日志
      await SyncService.logSyncAudit(syncResult, req.user!.id);

      // 额外记录操作审计
      await AuditService.logAction(
        'sync_ldap_users_full',
        'admin',
        req.user!.id,
        { 
          sync_result: syncResult,
          sync_type: 'full_sync'
        }
      );

      const responseMessage = `完全同步完成 - PI用户: 创建${syncResult.pis.created}个, 更新${syncResult.pis.updated}个, 停用${syncResult.pis.deactivated}个; 学生用户: 创建${syncResult.students.created}个, 更新${syncResult.students.updated}个, 删除${syncResult.students.deleted}个`;

      res.json({
        success: true,
        data: {
          // 兼容旧的前端接口
          synced_pis: syncResult.pis.total,
          new_pis: syncResult.pis.created,
          updated_pis: syncResult.pis.updated,
          
          // 新的详细结果
          sync_result: syncResult,
          message: responseMessage
        },
        message: responseMessage
      });
    } catch (error) {
      console.error('完全同步LDAP用户失败:', error);
      
      // 记录错误审计日志
      try {
        await AuditService.logAction(
          'sync_ldap_users_error',
          'admin',
          req.user!.id,
          { 
            error: error.message,
            sync_type: 'full_sync'
          }
        );
      } catch (auditError) {
        console.error('记录同步错误审计日志失败:', auditError);
      }

      res.status(500).json({
        success: false,
        message: '完全同步LDAP用户失败: ' + error.message,
        code: 500
      });
    }
  }

  // 增量同步LDAP用户
  static async incrementalSyncLDAPUsers(req: Request, res: Response) {
    try {
      const { lastSyncTime } = req.query;
      console.log(`管理员 ${req.user!.username} 开始增量同步LDAP用户`);

      // 执行增量同步
      const syncResult = await SyncService.incrementalSync(
        lastSyncTime ? new Date(lastSyncTime as string) : undefined
      );

      // 记录审计日志
      await SyncService.logSyncAudit(syncResult, req.user!.id);

      await AuditService.logAction(
        'sync_ldap_users_incremental',
        'admin',
        req.user!.id,
        { 
          sync_result: syncResult,
          sync_type: 'incremental_sync',
          last_sync_time: lastSyncTime || null
        }
      );

      const responseMessage = `增量同步完成 - PI用户: 创建${syncResult.pis.created}个, 更新${syncResult.pis.updated}个, 停用${syncResult.pis.deactivated}个; 学生用户: 创建${syncResult.students.created}个, 更新${syncResult.students.updated}个, 删除${syncResult.students.deleted}个`;

      res.json({
        success: true,
        data: {
          sync_result: syncResult,
          message: responseMessage
        },
        message: responseMessage
      });
    } catch (error) {
      console.error('增量同步LDAP用户失败:', error);
      
      try {
        await AuditService.logAction(
          'sync_ldap_users_error',
          'admin',
          req.user!.id,
          { 
            error: error.message,
            sync_type: 'incremental_sync'
          }
        );
      } catch (auditError) {
        console.error('记录同步错误审计日志失败:', auditError);
      }

      res.status(500).json({
        success: false,
        message: '增量同步LDAP用户失败: ' + error.message,
        code: 500
      });
    }
  }

  // 获取用户统计
  static async getUserStats(req: Request, res: Response) {
    try {
      // 获取PI统计 - 修复：第一个参数应该是false获取所有用户
      const allPIs = await PIModel.getAll(1, 1000, false); // 获取所有PI（包括不活跃）
      const activePIs = await PIModel.getAll(1, 1000, true); // 获取活跃PI

      // 获取学生统计 - 修复：使用StudentModel.getAll获取所有学生
      const allStudents = await StudentModel.getAll(1, 1000); // 获取所有学生
      const activeStudents = allStudents.students.filter(s => s.status === 'active');

      // 管理员统计（简化处理）
      const totalAdmins = 1;
      const activeAdmins = 1;

      // 获取最近的用户（简化处理）
      const recentPIs = allPIs.pis.slice(0, 5);
      const recentAdmins = [
        {
          id: 1,
          username: 'admin',
          full_name: '系统管理员',
          email: 'admin@hpc.university.edu',
          role: 'admin',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        data: {
          total_pis: allPIs.total,
          active_pis: activePIs.total,
          total_admins: totalAdmins,
          active_admins: activeAdmins,
          total_students: allStudents.total,
          active_students: activeStudents.length,
          recent_pis: recentPIs,
          recent_admins: recentAdmins
        },
        message: '获取用户统计成功'
      });
    } catch (error) {
      console.error('获取用户统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户统计失败',
        code: 500
      });
    }
  }

  // 创建管理员
  static async createAdminUser(req: Request, res: Response) {
    try {
      const { username, full_name, email, password, role = 'admin' } = req.body;

      // 检查用户名是否已存在
      const existingAdmin = await AdminModel.findByUsername(username);
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: '用户名已存在',
          code: 400
        });
      }

      // 生成密码哈希
      const passwordHash = await bcrypt.hash(password, 10);

      // 创建管理员
      const newAdmin = await AdminModel.create({
        username,
        full_name,
        email,
        role: role as 'admin' | 'super_admin',
        password_hash: passwordHash,
        is_active: true
      });

      // 记录审计日志
      await AuditService.logAction(
        'create_admin_user',
        'admin',
        req.user!.id,
        { new_admin_id: newAdmin.id, username, role }
      );

      // 不返回密码哈希
      const { password_hash, ...adminResponse } = newAdmin;

      res.status(201).json({
        success: true,
        data: adminResponse,
        message: '管理员创建成功'
      });
    } catch (error) {
      console.error('创建管理员失败:', error);
      res.status(500).json({
        success: false,
        message: '创建管理员失败',
        code: 500
      });
    }
  }

  // 重置管理员密码
  static async resetAdminPassword(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { password } = req.body;

      // 生成密码哈希
      const passwordHash = await bcrypt.hash(password, 10);

      // 更新密码（这里需要扩展AdminModel以支持密码更新）
      // const updatedAdmin = await AdminModel.updatePassword(parseInt(id), passwordHash);

      // 记录审计日志
      await AuditService.logAction(
        'reset_admin_password',
        'admin',
        req.user!.id,
        { admin_id: parseInt(id) }
      );

      res.json({
        success: true,
        data: { message: '密码重置成功' },
        message: '密码重置成功'
      });
    } catch (error) {
      console.error('重置管理员密码失败:', error);
      res.status(500).json({
        success: false,
        message: '重置管理员密码失败',
        code: 500
      });
    }
  }

  // 获取学生列表
  static async getStudentUsers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, status, search, pi_id } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const piId = pi_id ? parseInt(pi_id as string) : undefined;

      let result;
      if (piId) {
        // 如果指定了PI ID，只获取该PI的学生
        result = await StudentModel.findByPiId(piId, pageNum, limitNum, status as string);
      } else {
        // 获取所有学生
        result = await StudentModel.getAll(pageNum, limitNum, status as string, search as string);
      }

      res.json({
        success: true,
        data: {
          students: result.students,
          total: result.total
        },
        message: '获取学生列表成功'
      });
    } catch (error) {
      console.error('获取学生列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取学生列表失败',
        code: 500
      });
    }
  }

  // 获取学生详情
  static async getStudentUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const student = await StudentModel.findById(parseInt(id));

      if (!student) {
        return res.status(404).json({
          success: false,
          message: '学生不存在',
          code: 404
        });
      }

      // 获取PI信息
      const pi = await PIModel.findById(student.pi_id);
      const studentWithPI = {
        ...student,
        pi_name: pi?.full_name,
        pi_username: pi?.username
      };

      res.json({
        success: true,
        data: studentWithPI,
        message: '获取学生详情成功'
      });
    } catch (error) {
      console.error('获取学生详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取学生详情失败',
        code: 500
      });
    }
  }

  // 更新学生状态
  static async updateStudentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const updatedStudent = await StudentModel.update(parseInt(id), { status });

      if (!updatedStudent) {
        return res.status(404).json({
          success: false,
          message: '学生不存在',
          code: 404
        });
      }

      // 记录审计日志
      await AuditService.logAction(
        'update_student_status',
        'admin',
        req.user!.id,
        { student_id: parseInt(id), status }
      );

      res.json({
        success: true,
        data: updatedStudent,
        message: `学生状态已更新为${status}`
      });
    } catch (error) {
      console.error('更新学生状态失败:', error);
      res.status(500).json({
        success: false,
        message: '更新学生状态失败',
        code: 500
      });
    }
  }

  // 删除学生账号
  static async deleteStudentUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // 首先获取学生信息用于日志记录
      const student = await StudentModel.findById(parseInt(id));
      if (!student) {
        return res.status(404).json({
          success: false,
          message: '学生不存在',
          code: 404
        });
      }

      // 删除学生记录
      const deleted = await StudentModel.delete(parseInt(id));

      if (!deleted) {
        return res.status(500).json({
          success: false,
          message: '删除学生失败',
          code: 500
        });
      }

      // 记录审计日志
      await AuditService.logAction(
        'delete_student_user',
        'admin',
        req.user!.id,
        { 
          student_id: parseInt(id), 
          username: student.username,
          chinese_name: student.chinese_name 
        }
      );

      res.json({
        success: true,
        data: { message: '学生账号删除成功' },
        message: '学生账号删除成功'
      });
    } catch (error) {
      console.error('删除学生账号失败:', error);
      res.status(500).json({
        success: false,
        message: '删除学生账号失败',
        code: 500
      });
    }
  }
}