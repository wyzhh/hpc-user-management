import pool from '../config/database';
import { PIInfo, Student, Request, Admin, AuditLog } from '../types';

export class PIModel {
  static async findByUsername(username: string): Promise<PIInfo | null> {
    const query = 'SELECT * FROM pis WHERE username = $1 AND is_active = true';
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<PIInfo | null> {
    const query = 'SELECT * FROM pis WHERE id = $1 AND is_active = true';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByLdapDn(ldapDn: string): Promise<PIInfo | null> {
    const query = 'SELECT * FROM pis WHERE ldap_dn = $1 AND is_active = true';
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
    const whereClause = activeOnly ? 'WHERE is_active = true' : '';
    
    const countQuery = `SELECT COUNT(*) FROM pis ${whereClause}`;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT * FROM pis ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    
    return { pis: result.rows, total };
  }
}

export class StudentModel {
  static async findByUsername(username: string): Promise<Student | null> {
    const query = 'SELECT * FROM students WHERE username = $1';
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
    let whereClause = 'WHERE pi_id = $1';
    const params: any[] = [piId];

    if (status) {
      whereClause += ' AND status = $2';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) FROM students ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const query = `
      SELECT * FROM students ${whereClause}
      ORDER BY created_at DESC
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
}

export class RequestModel {
  static async create(data: Omit<Request, 'id' | 'requested_at' | 'reviewed_at'>): Promise<Request> {
    const query = `
      INSERT INTO requests (pi_id, request_type, student_id, student_data, status, reason, admin_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [data.pi_id, data.request_type, data.student_id, JSON.stringify(data.student_data), data.status, data.reason, data.admin_id];
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
      SELECT r.*, p.username as pi_username, p.full_name as pi_name
      FROM requests r
      JOIN pis p ON r.pi_id = p.id
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