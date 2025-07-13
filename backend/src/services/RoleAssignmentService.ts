import { UserModel } from '../models/User';
import { User, PIInfo, Student, RoleAssignmentRequest } from '../types';
import pool from '../config/database';

export class RoleAssignmentService {
  // 分配用户为PI角色
  async assignUserAsPI(userId: number, piData: Partial<PIInfo>): Promise<PIInfo> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 更新用户类型
      const user = await UserModel.assignRole(userId, 'pi');
      if (!user) {
        throw new Error(`用户 ID ${userId} 不存在`);
      }

      // 创建PI记录
      const piQuery = `
        INSERT INTO pis (
          user_id, department, office_location, research_area, max_students, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const piValues = [
        userId,
        piData.department || '',
        piData.office_location || '',
        piData.research_area || '',
        piData.max_students || 10,
        true
      ];

      const piResult = await client.query(piQuery, piValues);
      const pi = piResult.rows[0];

      await client.query('COMMIT');

      // 返回完整的PI信息
      return {
        ...pi,
        user,
        // 兼容字段
        ldap_dn: user.ldap_dn,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('分配PI角色失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // 分配用户为学生角色
  async assignUserAsStudent(userId: number, studentData: Partial<Student>): Promise<Student> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 更新用户类型
      const user = await UserModel.assignRole(userId, 'student');
      if (!user) {
        throw new Error(`用户 ID ${userId} 不存在`);
      }

      // 创建学生记录
      const studentQuery = `
        INSERT INTO students (
          user_id, pi_id, student_id, major, enrollment_year, 
          degree_level, status, join_date, expected_graduation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const studentValues = [
        userId,
        studentData.pi_id || null,
        studentData.student_id || '',
        studentData.major || '',
        studentData.enrollment_year || null,
        studentData.degree_level || null,
        'active',
        studentData.join_date || null,
        studentData.expected_graduation || null
      ];

      const studentResult = await client.query(studentQuery, studentValues);
      const student = studentResult.rows[0];

      await client.query('COMMIT');

      // 获取PI信息（如果有）
      let piInfo = null;
      if (student.pi_id) {
        const piQuery = `
          SELECT p.*, u.username as pi_username, u.full_name as pi_name
          FROM pis p
          JOIN users u ON p.user_id = u.id
          WHERE p.id = $1
        `;
        const piResult = await pool.query(piQuery, [student.pi_id]);
        if (piResult.rows.length > 0) {
          piInfo = piResult.rows[0];
        }
      }

      // 返回完整的学生信息
      return {
        ...student,
        user,
        pi_name: piInfo?.pi_name,
        pi_username: piInfo?.pi_username,
        // 兼容字段
        username: user.username,
        chinese_name: user.full_name,
        email: user.email,
        phone: user.phone,
        ldap_dn: user.ldap_dn
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('分配学生角色失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // 批量分配角色
  async batchAssignRoles(assignments: RoleAssignmentRequest[]): Promise<{
    successful: number;
    failed: Array<{ userId: number; error: string }>;
  }> {
    let successful = 0;
    const failed: Array<{ userId: number; error: string }> = [];

    for (const assignment of assignments) {
      try {
        if (assignment.role_type === 'pi') {
          await this.assignUserAsPI(assignment.user_id, assignment.role_data);
        } else if (assignment.role_type === 'student') {
          await this.assignUserAsStudent(assignment.user_id, assignment.role_data);
        }
        successful++;
      } catch (error) {
        failed.push({
          userId: assignment.user_id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { successful, failed };
  }

  // 取消角色分配（回到unassigned状态）
  async unassignUserRole(userId: number): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 获取用户当前角色
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error(`用户 ID ${userId} 不存在`);
      }

      // 删除对应的角色记录
      if (user.user_type === 'pi') {
        await client.query('DELETE FROM pis WHERE user_id = $1', [userId]);
      } else if (user.user_type === 'student') {
        await client.query('DELETE FROM students WHERE user_id = $1', [userId]);
      }

      // 更新用户类型为unassigned
      await UserModel.assignRole(userId, 'unassigned' as any);

      await client.query('COMMIT');
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('取消角色分配失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // 更改用户角色
  async changeUserRole(userId: number, newRoleType: 'pi' | 'student', roleData: any): Promise<PIInfo | Student> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 先取消当前角色
      await this.unassignUserRole(userId);

      // 分配新角色
      let result;
      if (newRoleType === 'pi') {
        result = await this.assignUserAsPI(userId, roleData);
      } else {
        result = await this.assignUserAsStudent(userId, roleData);
      }

      await client.query('COMMIT');
      return result;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('更改用户角色失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // 获取未分配角色的用户列表
  async getUnassignedUsers(page = 1, limit = 20, search?: string): Promise<{
    users: User[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const result = await UserModel.getAll(page, limit, 'unassigned', true, search);
    
    return {
      users: result.users,
      total: result.total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(result.total / limit)
      }
    };
  }

  // 根据课题组推荐角色分配
  async suggestRolesByResearchGroup(gidNumber: number): Promise<{
    suggestedPI: User[];
    suggestedStudents: User[];
    reasoning: string;
  }> {
    try {
      // 获取该课题组的所有用户
      const groupUsers = await UserModel.findByGidNumber(gidNumber);
      const unassignedUsers = groupUsers.filter(user => user.user_type === 'unassigned');

      if (unassignedUsers.length === 0) {
        return {
          suggestedPI: [],
          suggestedStudents: [],
          reasoning: '该课题组没有未分配角色的用户'
        };
      }

      // 简单的启发式规则：
      // 1. 如果用户名包含 'prof', 'pi', 'teacher' 等，建议为PI
      // 2. 如果用户名包含数字（可能是学号），建议为学生
      // 3. 其他情况根据邮箱域名或其他特征判断

      const suggestedPI: User[] = [];
      const suggestedStudents: User[] = [];

      for (const user of unassignedUsers) {
        const username = user.username.toLowerCase();
        const email = user.email.toLowerCase();

        // PI识别规则
        if (
          username.includes('prof') ||
          username.includes('pi') ||
          username.includes('teacher') ||
          username.includes('faculty') ||
          email.includes('faculty') ||
          email.includes('prof')
        ) {
          suggestedPI.push(user);
        }
        // 学生识别规则
        else if (
          /\d{4,}/.test(username) || // 包含4位以上数字（可能是学号）
          email.includes('student') ||
          username.includes('student') ||
          username.includes('phd') ||
          username.includes('master') ||
          username.includes('undergraduate')
        ) {
          suggestedStudents.push(user);
        }
        // 默认归为学生
        else {
          suggestedStudents.push(user);
        }
      }

      let reasoning = `基于课题组 ${gidNumber} 的 ${unassignedUsers.length} 个用户分析:\n`;
      reasoning += `- 推荐 ${suggestedPI.length} 个用户为PI (基于用户名/邮箱特征)\n`;
      reasoning += `- 推荐 ${suggestedStudents.length} 个用户为学生\n`;
      reasoning += '建议：请人工确认这些推荐，特别是PI角色的分配';

      return {
        suggestedPI,
        suggestedStudents,
        reasoning
      };

    } catch (error) {
      console.error('课题组角色推荐失败:', error);
      throw error;
    }
  }

  // 获取角色分配统计
  async getRoleAssignmentStats(): Promise<{
    total: number;
    by_role: { [key: string]: number };
    by_research_group: Array<{ gid_number: number; user_count: number; pi_count: number; student_count: number }>;
    unassigned_count: number;
  }> {
    // 获取用户统计
    const userStats = await UserModel.getStats();

    // 获取按课题组的统计
    const groupStatsQuery = `
      SELECT 
        gid_number,
        COUNT(*) as user_count,
        COUNT(*) FILTER (WHERE user_type = 'pi') as pi_count,
        COUNT(*) FILTER (WHERE user_type = 'student') as student_count
      FROM users 
      WHERE gid_number IS NOT NULL AND is_active = true
      GROUP BY gid_number
      ORDER BY gid_number
    `;

    const groupStatsResult = await pool.query(groupStatsQuery);

    return {
      total: userStats.total,
      by_role: userStats.by_type,
      by_research_group: groupStatsResult.rows.map(row => ({
        gid_number: row.gid_number,
        user_count: parseInt(row.user_count),
        pi_count: parseInt(row.pi_count),
        student_count: parseInt(row.student_count)
      })),
      unassigned_count: userStats.by_type.unassigned || 0
    };
  }

  // 验证角色分配的合理性
  async validateRoleAssignment(userId: number, roleType: 'pi' | 'student'): Promise<{
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  }> {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        return {
          isValid: false,
          warnings: ['用户不存在'],
          suggestions: []
        };
      }

      if (user.user_type !== 'unassigned') {
        warnings.push(`用户当前已有角色: ${user.user_type}`);
        suggestions.push('如需更改角色，请先取消当前角色分配');
      }

      // 检查课题组情况
      if (user.gid_number) {
        const groupUsers = await UserModel.findByGidNumber(user.gid_number);
        const piCount = groupUsers.filter(u => u.user_type === 'pi').length;
        const studentCount = groupUsers.filter(u => u.user_type === 'student').length;

        if (roleType === 'pi' && piCount >= 2) {
          warnings.push(`课题组 ${user.gid_number} 已有 ${piCount} 个PI，添加更多PI可能不合理`);
        }

        if (roleType === 'student' && studentCount >= 20) {
          warnings.push(`课题组 ${user.gid_number} 已有 ${studentCount} 个学生，学生数量较多`);
        }

        suggestions.push(`课题组 ${user.gid_number} 当前有 ${piCount} 个PI，${studentCount} 个学生`);
      }

      // 基于用户信息的建议
      const username = user.username.toLowerCase();
      if (roleType === 'pi' && /\d{6,}/.test(username)) {
        warnings.push('用户名包含较长数字序列，可能是学生账号');
      }

      if (roleType === 'student' && username.includes('prof')) {
        warnings.push('用户名包含"prof"，可能是教师账号');
      }

      return {
        isValid: warnings.length === 0,
        warnings,
        suggestions
      };

    } catch (error) {
      return {
        isValid: false,
        warnings: [`验证失败: ${error}`],
        suggestions: []
      };
    }
  }
}

export const roleAssignmentService = new RoleAssignmentService();