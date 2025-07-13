import pool from '../config/database';
import { User, LDAPUser } from '../types';

export class UserModel {
  // 查找用户通过用户名
  static async findByUsername(username: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  // 查找用户通过ID
  static async findById(id: number): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  // 查找用户通过UID
  static async findByUidNumber(uidNumber: number): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE uid_number = $1';
    const result = await pool.query(query, [uidNumber]);
    return result.rows[0] || null;
  }

  // 获取所有用户（支持分页和过滤）
  static async getAll(
    page = 1, 
    limit = 10, 
    userType?: string, 
    isActive?: boolean,
    search?: string
  ): Promise<{ users: User[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = '';
    let params: any[] = [];

    const conditions = [];
    
    if (userType) {
      conditions.push(`user_type = $${params.length + 1}`);
      params.push(userType);
    }
    
    if (isActive !== undefined) {
      conditions.push(`is_active = $${params.length + 1}`);
      params.push(isActive);
    }
    
    if (search) {
      conditions.push(`(username ILIKE $${params.length + 1} OR full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT * FROM users ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    
    return { users: result.rows, total };
  }

  // 创建用户
  static async create(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const query = `
      INSERT INTO users (
        ldap_dn, username, uid_number, gid_number, full_name, email, phone,
        home_directory, login_shell, user_type, is_active, is_deleted_from_ldap, last_sync_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const values = [
      data.ldap_dn, data.username, data.uid_number, data.gid_number, 
      data.full_name, data.email, data.phone, data.home_directory, 
      data.login_shell, data.user_type, data.is_active, 
      data.is_deleted_from_ldap, data.last_sync_at
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // 更新用户
  static async update(id: number, data: Partial<User>): Promise<User | null> {
    const fields = Object.keys(data).filter(key => 
      key !== 'id' && key !== 'created_at' && key !== 'updated_at'
    );
    
    if (fields.length === 0) return null;

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING *
    `;
    
    const values = [id, ...fields.map(field => data[field as keyof User])];
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  // 批量导入/更新用户 (Upsert)
  static async upsertFromLDAP(ldapUser: LDAPUser): Promise<User> {
    const query = `
      INSERT INTO users (
        ldap_dn, username, uid_number, gid_number, full_name, email, phone,
        home_directory, login_shell, user_type, is_active, is_deleted_from_ldap, last_sync_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unassigned', true, false, CURRENT_TIMESTAMP)
      ON CONFLICT (username) DO UPDATE SET
        ldap_dn = EXCLUDED.ldap_dn,
        uid_number = EXCLUDED.uid_number,
        gid_number = EXCLUDED.gid_number,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        home_directory = EXCLUDED.home_directory,
        login_shell = EXCLUDED.login_shell,
        is_deleted_from_ldap = false,
        last_sync_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      ldapUser.dn,
      ldapUser.uid,
      ldapUser.uidNumber,
      ldapUser.gidNumber,
      ldapUser.displayName || ldapUser.cn,
      ldapUser.mail,
      ldapUser.telephoneNumber,
      ldapUser.homeDirectory,
      ldapUser.loginShell || '/bin/bash'
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // 标记用户为LDAP中已删除
  static async markAsDeletedFromLDAP(usernames: string[]): Promise<number> {
    if (usernames.length === 0) return 0;
    
    const placeholders = usernames.map((_, index) => `$${index + 1}`).join(', ');
    const query = `
      UPDATE users 
      SET is_deleted_from_ldap = true, updated_at = CURRENT_TIMESTAMP
      WHERE username NOT IN (${placeholders}) AND is_deleted_from_ldap = false
    `;
    
    const result = await pool.query(query, usernames);
    return result.rowCount || 0;
  }

  // 根据GID获取用户 (课题组成员)
  static async findByGidNumber(gidNumber: number): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE gid_number = $1 ORDER BY username';
    const result = await pool.query(query, [gidNumber]);
    return result.rows;
  }

  // 获取未分配角色的用户
  static async getUnassignedUsers(page = 1, limit = 10): Promise<{ users: User[], total: number }> {
    return this.getAll(page, limit, 'unassigned', true);
  }

  // 分配用户角色
  static async assignRole(userId: number, roleType: 'pi' | 'student'): Promise<User | null> {
    return this.update(userId, { user_type: roleType });
  }

  // 删除用户 (软删除)
  static async softDelete(id: number): Promise<boolean> {
    const result = await this.update(id, { is_active: false });
    return result !== null;
  }

  // 恢复用户
  static async restore(id: number): Promise<boolean> {
    const result = await this.update(id, { is_active: true });
    return result !== null;
  }

  // 获取用户统计
  static async getStats(): Promise<{
    total: number;
    by_type: { [key: string]: number };
    active: number;
    deleted_from_ldap: number;
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_deleted_from_ldap = true) as deleted_from_ldap,
        COUNT(*) FILTER (WHERE user_type = 'pi') as pi_count,
        COUNT(*) FILTER (WHERE user_type = 'student') as student_count,
        COUNT(*) FILTER (WHERE user_type = 'unassigned') as unassigned_count
      FROM users
    `;
    
    const result = await pool.query(statsQuery);
    const stats = result.rows[0];
    
    return {
      total: parseInt(stats.total),
      active: parseInt(stats.active),
      deleted_from_ldap: parseInt(stats.deleted_from_ldap),
      by_type: {
        pi: parseInt(stats.pi_count),
        student: parseInt(stats.student_count),
        unassigned: parseInt(stats.unassigned_count)
      }
    };
  }

  // 删除用户
  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }
}