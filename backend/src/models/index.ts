import pool from '../config/database';
import { PIInfo, Student, Request, Admin, AuditLog } from '../types';

export class PIModel {
  static async findByUsername(username: string): Promise<PIInfo | null> {
    const query = `
      SELECT p.*, u.username, u.full_name, u.email, u.phone, u.ldap_dn
      FROM pis p
      JOIN users u ON p.user_id = u.id
      WHERE u.username = $1 AND p.is_active = true
    `;
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<PIInfo | null> {
    const query = `
      SELECT p.*, u.username, u.full_name, u.email, u.phone, u.ldap_dn
      FROM pis p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1 AND p.is_active = true
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByLdapDn(ldapDn: string): Promise<PIInfo | null> {
    const query = `
      SELECT p.*, u.username, u.full_name, u.email, u.phone, u.ldap_dn
      FROM pis p
      JOIN users u ON p.user_id = u.id
      WHERE u.ldap_dn = $1 AND p.is_active = true
    `;
    const result = await pool.query(query, [ldapDn]);
    return result.rows[0] || null;
  }

  static async create(data: Omit<PIInfo, 'id' | 'created_at' | 'updated_at'>): Promise<PIInfo> {
    const query = `
      INSERT INTO pis (ldap_dn, username, full_name, email, department, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [data.ldap_dn, data.username, data.full_name, data.email, data.department, data.phone, data.is_active];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async update(id: number, data: Partial<PIInfo>): Promise<PIInfo | null> {
    const fields = Object.keys(data).filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at');
    const values = fields.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const query = `UPDATE pis SET ${values} WHERE id = $1 RETURNING *`;
    const params = [id, ...fields.map(key => data[key as keyof PIInfo])];
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  }

  static async getAll(page = 1, limit = 10, activeOnly = true): Promise<{ pis: PIInfo[], total: number }> {
    const offset = (page - 1) * limit;
    const whereClause = activeOnly ? 'WHERE p.is_active = true' : '';
    
    const countQuery = `SELECT COUNT(*) FROM pis p ${whereClause}`;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT p.*, u.username, u.full_name, u.email, u.phone, u.ldap_dn
      FROM pis p
      JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    
    return { pis: result.rows, total };
  }

  static async findByLdapDnBatch(ldapDns: string[]): Promise<PIInfo[]> {
    if (ldapDns.length === 0) return [];
    
    const placeholders = ldapDns.map((_, index) => `$${index + 1}`).join(', ');
    const query = `SELECT * FROM pis WHERE ldap_dn IN (${placeholders})`;
    const result = await pool.query(query, ldapDns);
    return result.rows;
  }

  static async upsert(data: Omit<PIInfo, 'id' | 'created_at' | 'updated_at'>): Promise<PIInfo> {
    const query = `
      INSERT INTO pis (ldap_dn, username, full_name, email, department, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (username) DO UPDATE SET
        ldap_dn = EXCLUDED.ldap_dn,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        department = EXCLUDED.department,
        phone = EXCLUDED.phone,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [data.ldap_dn, data.username, data.full_name, data.email, data.department, data.phone, data.is_active];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async markInactiveByLdapDns(excludeLdapDns: string[]): Promise<number> {
    if (excludeLdapDns.length === 0) {
      // 如果没有排除的DN，标记所有用户为不活跃
      const result = await pool.query('UPDATE pis SET is_active = false WHERE is_active = true');
      return result.rowCount;
    }
    
    const placeholders = excludeLdapDns.map((_, index) => `$${index + 1}`).join(', ');
    const query = `
      UPDATE pis SET is_active = false 
      WHERE ldap_dn NOT IN (${placeholders}) AND is_active = true
    `;
    const result = await pool.query(query, excludeLdapDns);
    return result.rowCount;
  }
}

export class StudentModel {
  static async findByUsername(username: string): Promise<Student | null> {
    const query = `
      SELECT s.*, u.username, u.full_name, u.email 
      FROM students s 
      JOIN users u ON s.user_id = u.id 
      WHERE u.username = $1
    `;
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<Student | null> {
    const query = 'SELECT * FROM students WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByPiId(piId: number, page = 1, limit = 10, status?: string): Promise<{ students: Student[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE s.pi_id = $1';
    const params: any[] = [piId];

    if (status) {
      whereClause += ' AND s.status = $2';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) FROM students s ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT s.*, u.username, u.full_name as chinese_name, u.email, u.phone
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    
    return { students: result.rows, total };
  }

  static async getAll(page = 1, limit = 10, status?: string, search?: string): Promise<{ students: Student[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = '';
    let params: any[] = [];

    const conditions = [];
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (search) {
      conditions.push(`(username ILIKE $${params.length + 1} OR chinese_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const countQuery = `SELECT COUNT(*) FROM students ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT s.*, u.username as pi_username, u.full_name as pi_name
      FROM students s
      LEFT JOIN pis p ON s.pi_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    
    return { students: result.rows, total };
  }

  static async create(data: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<Student> {
    const query = `
      INSERT INTO students (username, chinese_name, email, phone, pi_id, ldap_dn, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [data.username, data.chinese_name, data.email, data.phone, data.pi_id, data.ldap_dn, data.status];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async update(id: number, data: Partial<Student>): Promise<Student | null> {
    const fields = Object.keys(data).filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at');
    const values = fields.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const query = `UPDATE students SET ${values} WHERE id = $1 RETURNING *`;
    const params = [id, ...fields.map(key => data[key as keyof Student])];
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM students WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }

  static async checkOwnership(studentId: number, piId: number): Promise<boolean> {
    const query = 'SELECT pi_id FROM students WHERE id = $1';
    const result = await pool.query(query, [studentId]);
    return result.rows[0]?.pi_id === piId;
  }

  static async findByLdapDnBatch(ldapDns: string[]): Promise<Student[]> {
    if (ldapDns.length === 0) return [];
    
    const placeholders = ldapDns.map((_, index) => `$${index + 1}`).join(', ');
    const query = `SELECT * FROM students WHERE ldap_dn IN (${placeholders})`;
    const result = await pool.query(query, ldapDns);
    return result.rows;
  }

  static async upsert(data: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<Student> {
    const query = `
      INSERT INTO students (username, chinese_name, email, phone, pi_id, ldap_dn, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (username) DO UPDATE SET
        chinese_name = EXCLUDED.chinese_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        pi_id = EXCLUDED.pi_id,
        ldap_dn = EXCLUDED.ldap_dn,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [data.username, data.chinese_name, data.email, data.phone, data.pi_id, data.ldap_dn, data.status];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async markDeletedByLdapDns(excludeLdapDns: string[]): Promise<number> {
    if (excludeLdapDns.length === 0) {
      // 如果没有排除的DN，标记所有学生为已删除
      const result = await pool.query("UPDATE students SET status = 'deleted' WHERE status != 'deleted'");
      return result.rowCount;
    }
    
    const placeholders = excludeLdapDns.map((_, index) => `$${index + 1}`).join(', ');
    const query = `
      UPDATE students SET status = 'deleted' 
      WHERE ldap_dn NOT IN (${placeholders}) AND status != 'deleted'
    `;
    const result = await pool.query(query, excludeLdapDns);
    return result.rowCount;
  }

  static async findPIByUsername(username: string): Promise<{ id: number } | null> {
    const query = 'SELECT id FROM pis WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  static async getStatsByPiId(piId: number): Promise<{
    total: number;
    active: number;
    pending: number;
    deleted: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'deleted' THEN 1 END) as deleted
      FROM students 
      WHERE pi_id = $1
    `;
    const result = await pool.query(query, [piId]);
    const row = result.rows[0];
    
    return {
      total: parseInt(row.total) || 0,
      active: parseInt(row.active) || 0,
      pending: parseInt(row.pending) || 0,
      deleted: parseInt(row.deleted) || 0,
    };
  }
}

export class RequestModel {
  static async create(data: Omit<Request, 'id' | 'requested_at' | 'reviewed_at'>): Promise<Request> {
    const query = `
      INSERT INTO requests (pi_id, request_type, student_user_id, status, reason)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [data.pi_id, data.request_type, data.student_user_id, data.status, data.reason];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<Request | null> {
    const query = 'SELECT * FROM requests WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByPiId(piId: number, page = 1, limit = 10, status?: string, type?: string): Promise<{ requests: Request[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE pi_id = $1';
    const params: any[] = [piId];

    if (status) {
      whereClause += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (type) {
      whereClause += ` AND request_type = $${params.length + 1}`;
      params.push(type);
    }

    const countQuery = `SELECT COUNT(*) FROM requests ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT * FROM requests ${whereClause}
      ORDER BY requested_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    
    return { requests: result.rows, total };
  }

  static async getAll(page = 1, limit = 10, status?: string, piId?: number): Promise<{ requests: Request[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: any[] = [];

    if (status || piId) {
      const conditions = [];
      if (status) {
        conditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }
      if (piId) {
        conditions.push(`pi_id = $${params.length + 1}`);
        params.push(piId);
      }
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const countQuery = `SELECT COUNT(*) FROM requests ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT r.*, u.username as pi_username, u.full_name as pi_name
      FROM requests r
      JOIN pis p ON r.pi_id = p.id
      JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY requested_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    
    return { requests: result.rows, total };
  }

  static async update(id: number, data: Partial<Request>): Promise<Request | null> {
    const fields = Object.keys(data).filter(key => key !== 'id' && key !== 'requested_at');
    if (data.reviewed_at === undefined && (data.status === 'approved' || data.status === 'rejected')) {
      fields.push('reviewed_at');
      data.reviewed_at = new Date();
    }
    
    const values = fields.map((key, index) => {
      if (key === 'student_data') {
        return `${key} = $${index + 2}`;
      }
      return `${key} = $${index + 2}`;
    }).join(', ');
    
    const query = `UPDATE requests SET ${values} WHERE id = $1 RETURNING *`;
    const params = [id, ...fields.map(key => {
      if (key === 'student_data') {
        return JSON.stringify(data[key as keyof Request]);
      }
      return data[key as keyof Request];
    })];
    
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  }
}

export class AdminModel {
  static async findByUsername(username: string): Promise<Admin | null> {
    const query = 'SELECT * FROM admins WHERE username = $1 AND is_active = true';
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<Admin | null> {
    const query = 'SELECT * FROM admins WHERE id = $1 AND is_active = true';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async create(data: Omit<Admin, 'id' | 'created_at'>): Promise<Admin> {
    const query = `
      INSERT INTO admins (username, full_name, email, role, password_hash, ldap_dn, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [data.username, data.full_name, data.email, data.role, data.password_hash, data.ldap_dn, data.is_active];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async update(id: number, data: Partial<Admin>): Promise<Admin | null> {
    const fields = Object.keys(data).filter(key => key !== 'id' && key !== 'created_at');
    const values = fields.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const query = `UPDATE admins SET ${values} WHERE id = $1 RETURNING *`;
    const params = [id, ...fields.map(key => data[key as keyof Admin])];
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  }
}

export class AuditLogModel {
  static async create(data: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    const query = `
      INSERT INTO audit_logs (request_id, action, performer_type, performer_id, details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [data.request_id, data.action, data.performer_type, data.performer_id, JSON.stringify(data.details)];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getByRequestId(requestId: number): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs 
      WHERE request_id = $1 
      ORDER BY created_at ASC
    `;
    const result = await pool.query(query, [requestId]);
    return result.rows;
  }

  static async getAll(page = 1, limit = 50): Promise<{ logs: AuditLog[], total: number }> {
    const offset = (page - 1) * limit;
    
    const countQuery = 'SELECT COUNT(*) FROM audit_logs';
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    
    return { logs: result.rows, total };
  }
}