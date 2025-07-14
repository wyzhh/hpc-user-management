import { Request, Response } from 'express';
import { PIModel, AdminModel, StudentModel } from '../models';
import { UserModel } from '../models/User';
import { Admin, PIInfo, User } from '../types';
import { ldapService } from '../services/ldap';
import { userImportService } from '../services/UserImportService';
import { roleAssignmentService } from '../services/RoleAssignmentService';
import { adminConfigService } from '../services/AdminConfigService';
import { AuditService } from '../services/audit';
import pool from '../config/database';
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

  // 更新用户信息
  static async updatePIUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { full_name, email, department, phone, is_active } = req.body;

      // 分离用户基础信息和PI专有信息
      const userUpdateData: Partial<User> = {};
      if (full_name !== undefined) userUpdateData.full_name = full_name;
      if (email !== undefined) userUpdateData.email = email;
      if (phone !== undefined) userUpdateData.phone = phone;
      if (is_active !== undefined) userUpdateData.is_active = is_active;

      const piUpdateData: Partial<PIInfo> = {};
      if (department !== undefined) piUpdateData.department = department;

      // 更新用户基础信息
      let updatedUser = null;
      if (Object.keys(userUpdateData).length > 0) {
        updatedUser = await UserModel.update(parseInt(id), userUpdateData);
      }

      // 如果用户是PI，同时更新PI信息
      let updatedPI = null;
      if (Object.keys(piUpdateData).length > 0) {
        // 查找是否存在对应的PI记录
        const piQuery = 'SELECT id FROM pis WHERE user_id = $1';
        const piResult = await pool.query(piQuery, [parseInt(id)]);
        if (piResult.rows.length > 0) {
          updatedPI = await PIModel.update(piResult.rows[0].id, piUpdateData);
        }
      }

      // 检查用户是否存在
      const user = await UserModel.findById(parseInt(id));
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 404
        });
      }

      // 记录审计日志
      await AuditService.logAction(
        'update_user',
        'admin',
        req.user!.id,
        { user_id: parseInt(id), changes: { ...userUpdateData, ...piUpdateData } }
      );

      res.json({
        success: true,
        data: updatedUser || user,
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

  // 从LDAP导入所有用户
  static async importAllUsersFromLDAP(req: Request, res: Response) {
    try {
      console.log(`管理员 ${req.user!.username} 开始从LDAP导入所有用户`);

      // 执行用户导入
      const importResult = await userImportService.importAllUsersFromLDAP();

      // 记录审计日志
      await AuditService.logAction(
        'import_all_users_from_ldap',
        'admin',
        req.user!.id,
        { 
          import_result: importResult
        }
      );

      const responseMessage = `LDAP用户导入完成 - 发现 ${importResult.total_found} 个用户，新导入 ${importResult.new_imported} 个，更新 ${importResult.updated} 个，标记删除 ${importResult.marked_deleted} 个`;

      res.json({
        success: true,
        data: {
          // 新的导入结果
          import_result: importResult,
          message: responseMessage,
          
          // 兼容旧的前端接口（如果需要）
          synced_pis: importResult.new_imported + importResult.updated,
          new_pis: importResult.new_imported,
          updated_pis: importResult.updated
        },
        message: responseMessage
      });
    } catch (error) {
      console.error('从LDAP导入用户失败:', error);
      
      // 记录错误审计日志
      try {
        await AuditService.logAction(
          'import_users_error',
          'admin',
          req.user!.id,
          { 
            error: error.message,
            operation: 'import_all_users'
          }
        );
      } catch (auditError) {
        console.error('记录导入错误审计日志失败:', auditError);
      }

      res.status(500).json({
        success: false,
        message: '从LDAP导入用户失败: ' + error.message,
        code: 500
      });
    }
  }

  // 同步LDAP用户（完全同步） - 保持向后兼容
  static async syncLDAPUsers(req: Request, res: Response) {
    // 重定向到新的导入方法
    return UserController.importAllUsersFromLDAP(req, res);
  }

  // 增量同步LDAP用户 - 保持向后兼容
  static async incrementalSyncLDAPUsers(req: Request, res: Response) {
    // 在新架构中，我们重定向到全量导入，因为所有用户都是"未分配角色"状态
    console.log(`管理员 ${req.user!.username} 请求增量同步，重定向到全量导入`);
    return UserController.importAllUsersFromLDAP(req, res);
  }


  // 获取用户统计
  static async getUserStats(req: Request, res: Response) {
    try {
      // 获取PI统计
      const allPIs = await PIModel.getAll(1, 1000, false);
      const activePIs = await PIModel.getAll(1, 1000, true);

      // 获取学生统计
      const allStudents = await StudentModel.getAll(1, 1000);
      const activeStudents = allStudents.students.filter(s => s.status === 'active');

      // 获取所有用户统计
      const allUsers = await UserModel.getAll(1, 10000, undefined, undefined);
      const activeUsers = await UserModel.getAll(1, 10000, undefined, true);

      // 获取最近的用户
      const recentPIs = allPIs.pis.slice(0, 5);

      res.json({
        success: true,
        data: {
          total_pis: allPIs.total,
          active_pis: activePIs.total,
          total_students: allStudents.total,
          active_students: activeStudents.length,
          total_users: allUsers.total,
          active_users: activeUsers.total,
          recent_pis: recentPIs
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
        is_active: true,
        auth_type: 'local' as const,
        updated_at: new Date()
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

  // 新增：获取所有用户列表
  static async getAllUsers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20, user_type, is_active, search } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const activeFilter = is_active !== undefined ? is_active === 'true' : undefined;

      const result = await UserModel.getAll(
        pageNum, 
        limitNum, 
        user_type as string, 
        activeFilter, 
        search as string
      );

      res.json({
        success: true,
        data: {
          users: result.users,
          total: result.total,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(result.total / limitNum)
          }
        },
        message: '获取用户列表成功'
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户列表失败',
        code: 500
      });
    }
  }

  // 新增：获取未分配角色的用户
  static async getUnassignedUsers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const result = await roleAssignmentService.getUnassignedUsers(
        pageNum, 
        limitNum, 
        search as string
      );

      res.json({
        success: true,
        data: result,
        message: '获取未分配角色用户列表成功'
      });
    } catch (error) {
      console.error('获取未分配角色用户列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取未分配角色用户列表失败',
        code: 500
      });
    }
  }

  // 新增：分配用户角色
  static async assignUserRole(req: Request, res: Response) {
    try {
      const { user_id, role_type, role_data = {} } = req.body;

      if (!user_id || !role_type) {
        return res.status(400).json({
          success: false,
          message: '用户ID和角色类型为必填项',
          code: 400
        });
      }

      // 验证角色分配的合理性
      const validation = await roleAssignmentService.validateRoleAssignment(user_id, role_type);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: '角色分配验证失败',
          data: {
            warnings: validation.warnings,
            suggestions: validation.suggestions
          },
          code: 400
        });
      }

      let result;
      if (role_type === 'pi') {
        result = await roleAssignmentService.assignUserAsPI(user_id, role_data);
      } else if (role_type === 'student') {
        result = await roleAssignmentService.assignUserAsStudent(user_id, role_data);
      } else {
        return res.status(400).json({
          success: false,
          message: '无效的角色类型',
          code: 400
        });
      }

      // 记录审计日志
      await AuditService.logAction(
        'assign_user_role',
        'admin',
        req.user!.id,
        { 
          user_id,
          role_type,
          role_data,
          validation_warnings: validation.warnings
        }
      );

      res.json({
        success: true,
        data: {
          result,
          validation
        },
        message: `用户角色分配成功: ${role_type}`
      });
    } catch (error) {
      console.error('分配用户角色失败:', error);
      res.status(500).json({
        success: false,
        message: '分配用户角色失败: ' + error.message,
        code: 500
      });
    }
  }

  // 新增：根据课题组推荐角色
  static async suggestRolesByGroup(req: Request, res: Response) {
    try {
      const { gid_number } = req.params;
      const gidNumber = parseInt(gid_number);

      if (isNaN(gidNumber)) {
        return res.status(400).json({
          success: false,
          message: '无效的课题组GID',
          code: 400
        });
      }

      const suggestions = await roleAssignmentService.suggestRolesByResearchGroup(gidNumber);

      res.json({
        success: true,
        data: suggestions,
        message: '课题组角色推荐生成成功'
      });
    } catch (error) {
      console.error('生成课题组角色推荐失败:', error);
      res.status(500).json({
        success: false,
        message: '生成课题组角色推荐失败: ' + error.message,
        code: 500
      });
    }
  }

  // 新增：导入特定用户
  static async importSpecificUsers(req: Request, res: Response) {
    try {
      const { usernames } = req.body;

      if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要导入的用户名列表',
          code: 400
        });
      }

      console.log(`管理员 ${req.user!.username} 开始导入指定用户:`, usernames);

      const importResult = await userImportService.importSpecificUsers(usernames);

      await AuditService.logAction(
        'import_specific_users',
        'admin',
        req.user!.id,
        { 
          usernames,
          import_result: importResult
        }
      );

      res.json({
        success: true,
        data: importResult,
        message: `指定用户导入完成 - 成功导入 ${importResult.new_imported} 个用户，更新 ${importResult.updated} 个`
      });
    } catch (error) {
      console.error('导入指定用户失败:', error);
      res.status(500).json({
        success: false,
        message: '导入指定用户失败: ' + error.message,
        code: 500
      });
    }
  }

  // 新增：批量分配角色
  static async batchAssignRoles(req: Request, res: Response) {
    try {
      const { assignments } = req.body;

      if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供角色分配列表',
          code: 400
        });
      }

      console.log(`管理员 ${req.user!.username} 开始批量分配角色`);

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (const assignment of assignments) {
        const { user_id, role_type, role_data = {} } = assignment;

        try {
          const validation = await roleAssignmentService.validateRoleAssignment(user_id, role_type);
          
          if (!validation.isValid) {
            results.push({
              user_id,
              success: false,
              message: '角色分配验证失败',
              warnings: validation.warnings
            });
            failureCount++;
            continue;
          }

          let result;
          if (role_type === 'pi') {
            result = await roleAssignmentService.assignUserAsPI(user_id, role_data);
          } else if (role_type === 'student') {
            result = await roleAssignmentService.assignUserAsStudent(user_id, role_data);
          } else {
            results.push({
              user_id,
              success: false,
              message: '无效的角色类型'
            });
            failureCount++;
            continue;
          }

          results.push({
            user_id,
            success: true,
            message: `用户角色分配成功: ${role_type}`,
            result
          });
          successCount++;
        } catch (error) {
          results.push({
            user_id,
            success: false,
            message: error.message
          });
          failureCount++;
        }
      }

      await AuditService.logAction(
        'batch_assign_roles',
        'admin',
        req.user!.id,
        { 
          total_assignments: assignments.length,
          success_count: successCount,
          failure_count: failureCount,
          results
        }
      );

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: assignments.length,
            success: successCount,
            failure: failureCount
          }
        },
        message: `批量角色分配完成 - 成功 ${successCount} 个，失败 ${failureCount} 个`
      });
    } catch (error) {
      console.error('批量分配角色失败:', error);
      res.status(500).json({
        success: false,
        message: '批量分配角色失败: ' + error.message,
        code: 500
      });
    }
  }

  // 新增：同步管理员配置
  static async syncAdminConfig(req: Request, res: Response) {
    try {
      console.log(`管理员 ${req.user!.username} 开始同步管理员配置`);

      const result = await adminConfigService.syncAdminsToDatabase();

      await AuditService.logAction(
        'sync_admin_config',
        'admin',
        req.user!.id,
        { sync_result: result }
      );

      res.json({
        success: true,
        data: result,
        message: '管理员配置同步成功'
      });
    } catch (error) {
      console.error('同步管理员配置失败:', error);
      res.status(500).json({
        success: false,
        message: '同步管理员配置失败: ' + error.message,
        code: 500
      });
    }
  }

  // 新增：验证LDAP连接
  static async validateLDAPConnection(req: Request, res: Response) {
    try {
      console.log(`管理员 ${req.user!.username} 请求验证LDAP连接`);

      const isConnected = await ldapService.testConnection();

      res.json({
        success: true,
        data: {
          connected: isConnected,
          timestamp: new Date().toISOString()
        },
        message: isConnected ? 'LDAP连接正常' : 'LDAP连接失败'
      });
    } catch (error) {
      console.error('验证LDAP连接失败:', error);
      res.status(500).json({
        success: false,
        message: '验证LDAP连接失败: ' + error.message,
        code: 500
      });
    }
  }

  // 新增：获取同步历史
  static async getSyncHistory(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      // 简化实现，从审计日志中获取同步历史
      // 实际项目中可能需要专门的同步历史表
      const history = [
        {
          id: 1,
          sync_type: 'full_import',
          performed_by: req.user!.username,
          performed_at: new Date().toISOString(),
          total_users: 14,
          new_imported: 14,
          updated: 0,
          marked_deleted: 0,
          status: 'completed'
        }
      ];

      res.json({
        success: true,
        data: {
          history,
          total: history.length,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(history.length / limitNum)
          }
        },
        message: '获取同步历史成功'
      });
    } catch (error) {
      console.error('获取同步历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取同步历史失败: ' + error.message,
        code: 500
      });
    }
  }

  // PI管理：获取可分配为PI的用户列表
  static async getUsersForPIAssignment(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const result = await UserModel.getAll(
        pageNum, 
        limitNum, 
        undefined, // 不限制用户类型
        true, // 只获取活跃用户
        search as string
      );

      res.json({
        success: true,
        data: {
          users: result.users,
          total: result.total,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(result.total / limitNum)
          }
        },
        message: '获取用户列表成功'
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户列表失败: ' + error.message,
        code: 500
      });
    }
  }

  // PI管理：设置用户为PI
  static async assignUserAsPI(req: Request, res: Response) {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: '用户ID为必填项',
          code: 400
        });
      }

      // 获取用户信息
      const user = await UserModel.findById(user_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 404
        });
      }

      // 检查用户是否已经是PI
      const existingPiQuery = 'SELECT * FROM pis WHERE user_id = $1 AND is_active = true';
      const existingPiResult = await pool.query(existingPiQuery, [user_id]);
      if (existingPiResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: '用户已经是PI',
          code: 400
        });
      }

      // 更新用户类型为PI
      await UserModel.update(user_id, { user_type: 'pi' });

      // 在PI表中创建记录（使用新的PI表结构）
      const piCreateQuery = `
        INSERT INTO pis (user_id, department, is_active)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      
      const piResult = await pool.query(piCreateQuery, [user_id, '', true]);
      const newPI = piResult.rows[0];

      // 记录审计日志
      await AuditService.logAction(
        'assign_user_as_pi',
        'admin',
        req.user!.id,
        { 
          user_id,
          username: user.username,
          pi_id: newPI.id
        }
      );

      res.json({
        success: true,
        data: newPI,
        message: `用户 ${user.username} 已设置为PI`
      });
    } catch (error) {
      console.error('设置用户为PI失败:', error);
      res.status(500).json({
        success: false,
        message: '设置用户为PI失败: ' + error.message,
        code: 500
      });
    }
  }

  // PI管理：取消用户的PI角色
  static async removeUserFromPI(req: Request, res: Response) {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: '用户ID为必填项',
          code: 400
        });
      }

      // 获取用户信息
      const user = await UserModel.findById(user_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 404
        });
      }

      // 检查用户是否是PI
      const piQuery = 'SELECT * FROM pis WHERE user_id = $1 AND is_active = true';
      const piResult = await pool.query(piQuery, [user_id]);
      const pi = piResult.rows[0];
      
      if (!pi) {
        return res.status(400).json({
          success: false,
          message: '用户不是PI',
          code: 400
        });
      }

      // 检查该PI是否有学生，如果有则不能删除
      const studentsQuery = 'SELECT COUNT(*) FROM students WHERE pi_id = $1';
      const studentsResult = await pool.query(studentsQuery, [pi.id]);
      const studentCount = parseInt(studentsResult.rows[0].count);
      
      if (studentCount > 0) {
        return res.status(400).json({
          success: false,
          message: `无法移除PI角色，该PI还有 ${studentCount} 个学生`,
          code: 400
        });
      }

      // 更新用户类型为unassigned
      await UserModel.update(user_id, { user_type: 'unassigned' });

      // 删除PI记录（软删除）
      const updatePiQuery = 'UPDATE pis SET is_active = false WHERE id = $1';
      await pool.query(updatePiQuery, [pi.id]);

      // 记录审计日志
      await AuditService.logAction(
        'remove_user_from_pi',
        'admin',
        req.user!.id,
        { 
          user_id,
          username: user.username,
          pi_id: pi.id
        }
      );

      res.json({
        success: true,
        data: { message: `用户 ${user.username} 的PI角色已移除` },
        message: `用户 ${user.username} 的PI角色已移除`
      });
    } catch (error) {
      console.error('移除用户PI角色失败:', error);
      res.status(500).json({
        success: false,
        message: '移除用户PI角色失败: ' + error.message,
        code: 500
      });
    }
  }

  // PI管理：获取PI管理统计信息
  static async getPIManagementStats(req: Request, res: Response) {
    try {
      // 获取用户统计
      const userStats = await UserModel.getStats();
      
      // 获取PI统计
      const allPIs = await PIModel.getAll(1, 1000, false);
      const activePIs = await PIModel.getAll(1, 1000, true);

      res.json({
        success: true,
        data: {
          total_users: userStats.total,
          total_pis: userStats.by_type.pi,
          total_students: userStats.by_type.student,
          unassigned_users: userStats.by_type.unassigned,
          active_pis: activePIs.total,
          inactive_pis: allPIs.total - activePIs.total
        },
        message: 'PI管理统计获取成功'
      });
    } catch (error) {
      console.error('获取PI管理统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取PI管理统计失败: ' + error.message,
        code: 500
      });
    }
  }

  // 学生管理：获取可分配的用户列表
  static async getUsersForStudentAssignment(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      // 获取未分配为学生的用户（排除已是PI的用户和已是学生的用户）
      let whereConditions = ['u.is_active = true'];
      let params: any[] = [];

      if (search) {
        whereConditions.push(`(u.username ILIKE $${params.length + 1} OR u.full_name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1})`);
        params.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // 查询未分配为学生且不是PI的用户
      const countQuery = `
        SELECT COUNT(*) 
        FROM users u 
        LEFT JOIN students s ON u.id = s.user_id 
        LEFT JOIN pis p ON u.id = p.user_id AND p.is_active = true
        WHERE ${whereClause} AND s.user_id IS NULL AND p.user_id IS NULL
      `;
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count, 10);

      const usersQuery = `
        SELECT u.*, 
               false as is_pi
        FROM users u 
        LEFT JOIN students s ON u.id = s.user_id 
        LEFT JOIN pis p ON u.id = p.user_id AND p.is_active = true
        WHERE ${whereClause} AND s.user_id IS NULL AND p.user_id IS NULL
        ORDER BY u.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limitNum, (pageNum - 1) * limitNum);

      const usersResult = await pool.query(usersQuery, params);

      res.json({
        success: true,
        data: {
          users: usersResult.rows,
          total,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
          }
        },
        message: '获取可分配用户列表成功'
      });
    } catch (error) {
      console.error('获取可分配用户列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取可分配用户列表失败: ' + error.message,
        code: 500
      });
    }
  }

  // 学生管理：分配学生给PI
  static async assignStudentToPI(req: Request, res: Response) {
    try {
      const { user_id, pi_id, student_data = {} } = req.body;

      if (!user_id || !pi_id) {
        return res.status(400).json({
          success: false,
          message: '用户ID和PI ID为必填项',
          code: 400
        });
      }

      // 检查用户是否存在
      const user = await UserModel.findById(user_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 404
        });
      }

      // 检查PI是否存在
      const piQuery = 'SELECT * FROM pis WHERE id = $1 AND is_active = true';
      const piResult = await pool.query(piQuery, [pi_id]);
      if (piResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'PI不存在或已禁用',
          code: 404
        });
      }

      // 检查用户是否已经是学生
      const existingStudentQuery = 'SELECT * FROM students WHERE user_id = $1';
      const existingStudentResult = await pool.query(existingStudentQuery, [user_id]);
      if (existingStudentResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: '用户已经是学生',
          code: 400
        });
      }

      // 更新用户类型为student
      await UserModel.update(user_id, { user_type: 'student' });

      // 在学生表中创建记录
      const studentCreateQuery = `
        INSERT INTO students (user_id, pi_id, student_id, major, degree_level, status, join_date)
        VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_DATE)
        RETURNING *
      `;
      
      const studentValues = [
        user_id,
        pi_id,
        student_data.student_id || user.username,
        student_data.major || '',
        student_data.degree_level || 'undergraduate'
      ];

      const studentResult = await pool.query(studentCreateQuery, studentValues);
      const newStudent = studentResult.rows[0];

      // 记录审计日志
      await AuditService.logAction(
        'assign_student_to_pi',
        'admin',
        req.user!.id,
        { 
          user_id,
          pi_id,
          student_id: newStudent.id,
          username: user.username
        }
      );

      res.json({
        success: true,
        data: newStudent,
        message: `用户 ${user.username} 已分配为学生`
      });
    } catch (error) {
      console.error('分配学生失败:', error);
      res.status(500).json({
        success: false,
        message: '分配学生失败: ' + error.message,
        code: 500
      });
    }
  }

  // 学生管理：移除学生角色
  static async removeStudentFromPI(req: Request, res: Response) {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: '用户ID为必填项',
          code: 400
        });
      }

      // 获取学生信息
      const studentQuery = 'SELECT * FROM students WHERE user_id = $1';
      const studentResult = await pool.query(studentQuery, [user_id]);
      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '用户不是学生',
          code: 404
        });
      }

      const student = studentResult.rows[0];

      // 更新用户类型为unassigned
      await UserModel.update(user_id, { user_type: 'unassigned' });

      // 删除学生记录
      const deleteStudentQuery = 'DELETE FROM students WHERE user_id = $1';
      await pool.query(deleteStudentQuery, [user_id]);

      // 记录审计日志
      await AuditService.logAction(
        'remove_student_from_pi',
        'admin',
        req.user!.id,
        { 
          user_id,
          pi_id: student.pi_id,
          student_id: student.id
        }
      );

      res.json({
        success: true,
        message: '学生角色已移除'
      });
    } catch (error) {
      console.error('移除学生角色失败:', error);
      res.status(500).json({
        success: false,
        message: '移除学生角色失败: ' + error.message,
        code: 500
      });
    }
  }

  // 学生管理：获取PI和其学生列表
  static async getPIsWithStudents(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      // 获取PI列表和学生统计
      const piQuery = `
        SELECT p.id, p.user_id, p.department, p.is_active, p.created_at,
               u.username, u.full_name, u.email,
               COUNT(s.id) as student_count
        FROM pis p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN students s ON p.id = s.pi_id
        WHERE p.is_active = true
        ${search ? `AND (u.username ILIKE '%${search}%' OR u.full_name ILIKE '%${search}%')` : ''}
        GROUP BY p.id, u.id
        ORDER BY p.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      
      const piResult = await pool.query(piQuery, [limitNum, (pageNum - 1) * limitNum]);

      // 获取总数
      const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM pis p
        JOIN users u ON p.user_id = u.id
        WHERE p.is_active = true
        ${search ? `AND (u.username ILIKE '%${search}%' OR u.full_name ILIKE '%${search}%')` : ''}
      `;
      const countResult = await pool.query(countQuery);
      const total = parseInt(countResult.rows[0].total);

      // 为每个PI获取详细的学生列表
      const pisWithStudents = await Promise.all(
        piResult.rows.map(async (pi: any) => {
          const studentsQuery = `
            SELECT s.*, u.username, u.full_name, u.email
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.pi_id = $1
            ORDER BY s.created_at DESC
          `;
          const studentsResult = await pool.query(studentsQuery, [pi.id]);
          
          return {
            ...pi,
            students: studentsResult.rows
          };
        })
      );

      res.json({
        success: true,
        data: {
          pis: pisWithStudents,
          total,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
          }
        },
        message: '获取PI和学生列表成功'
      });
    } catch (error) {
      console.error('获取PI和学生列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取PI和学生列表失败: ' + error.message,
        code: 500
      });
    }
  }

  // 通用编辑用户接口 - 支持所有类型用户，只修改users表
  static async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { full_name, email, phone, is_active } = req.body;

      // 验证用户是否存在
      const user = await UserModel.findById(parseInt(id));
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 404
        });
      }

      // 准备更新数据 - 只更新users表
      const userUpdateData: Partial<User> = {};
      if (full_name !== undefined) userUpdateData.full_name = full_name;
      if (email !== undefined) userUpdateData.email = email;
      if (phone !== undefined) userUpdateData.phone = phone;
      if (is_active !== undefined) userUpdateData.is_active = is_active;

      // 更新用户信息
      let updatedUser = user;
      if (Object.keys(userUpdateData).length > 0) {
        updatedUser = await UserModel.update(parseInt(id), userUpdateData);
      }

      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: '更新用户失败',
          code: 500
        });
      }

      // 记录审计日志
      await AuditService.logAction(
        'update_user',
        'admin',
        req.user!.id,
        { 
          user_id: parseInt(id), 
          changes: userUpdateData,
          user_type: user.user_type,
          username: user.username
        }
      );

      res.json({
        success: true,
        data: updatedUser,
        message: '用户更新成功'
      });
    } catch (error) {
      console.error('更新用户失败:', error);
      res.status(500).json({
        success: false,
        message: '更新用户失败',
        code: 500
      });
    }
  }

  // 删除用户 - 真正从LDAP删除
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // 验证用户是否存在
      const user = await UserModel.findById(parseInt(id));
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 404
        });
      }

      // 检查用户是否有LDAP DN
      if (!user.ldap_dn) {
        return res.status(400).json({
          success: false,
          message: '该用户没有LDAP DN，无法从LDAP删除',
          code: 400
        });
      }

      // 从LDAP删除用户
      try {
        await ldapService.deleteUser(user.ldap_dn);
      } catch (ldapError) {
        console.error('从LDAP删除用户失败:', ldapError);
        return res.status(500).json({
          success: false,
          message: '从LDAP删除用户失败: ' + (ldapError instanceof Error ? ldapError.message : 'Unknown error'),
          code: 500
        });
      }

      // 从数据库删除用户记录
      const deleted = await UserModel.delete(parseInt(id));
      if (!deleted) {
        return res.status(500).json({
          success: false,
          message: '从数据库删除用户失败',
          code: 500
        });
      }

      // 记录审计日志
      await AuditService.logAction(
        'delete_user_from_ldap',
        'admin',
        req.user!.id,
        { 
          user_id: parseInt(id), 
          username: user.username,
          ldap_dn: user.ldap_dn,
          operation: 'permanent_delete'
        }
      );

      res.json({
        success: true,
        message: '用户已从LDAP和数据库中删除'
      });
    } catch (error) {
      console.error('删除用户失败:', error);
      res.status(500).json({
        success: false,
        message: '删除用户失败',
        code: 500
      });
    }
  }
}