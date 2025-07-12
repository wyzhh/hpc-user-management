-- HPC用户管理系统数据库初始化脚本

-- PostgreSQL不支持CREATE DATABASE IF NOT EXISTS，跳过
-- 直接在当前数据库创建表

-- 创建PI表
CREATE TABLE IF NOT EXISTS pis (
    id SERIAL PRIMARY KEY,
    ldap_dn VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    department VARCHAR(200),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建学生用户表
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    chinese_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    pi_id INTEGER REFERENCES pis(id) ON DELETE CASCADE,
    ldap_dn VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'deleted')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建申请记录表
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    pi_id INTEGER REFERENCES pis(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('create', 'delete')),
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    student_data JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    admin_id INTEGER,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP
);

-- 创建管理员表
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建审核日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES requests(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    performer_type VARCHAR(20) NOT NULL CHECK (performer_type IN ('pi', 'admin', 'system')),
    performer_id INTEGER NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_pis_username ON pis(username);
CREATE INDEX IF NOT EXISTS idx_pis_email ON pis(email);
CREATE INDEX IF NOT EXISTS idx_pis_is_active ON pis(is_active);

CREATE INDEX IF NOT EXISTS idx_students_username ON students(username);
CREATE INDEX IF NOT EXISTS idx_students_pi_id ON students(pi_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);

CREATE INDEX IF NOT EXISTS idx_requests_pi_id ON requests(pi_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(request_type);
CREATE INDEX IF NOT EXISTS idx_requests_requested_at ON requests(requested_at);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);

CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performer ON audit_logs(performer_type, performer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要自动更新时间的表创建触发器
CREATE TRIGGER update_pis_updated_at BEFORE UPDATE ON pis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入初始管理员数据
INSERT INTO admins (username, full_name, email, role) VALUES 
('admin', '系统管理员', 'admin@hpc.university.edu', 'super_admin')
ON CONFLICT (username) DO NOTHING;

-- 插入测试PI数据（开发环境）
INSERT INTO pis (ldap_dn, username, full_name, email, department, phone) VALUES 
('uid=pi001,ou=pis,dc=hpc,dc=university,dc=edu', 'pi001', '张教授', 'zhang@hpc.university.edu', '计算机科学与技术学院', '010-12345678'),
('uid=pi002,ou=pis,dc=hpc,dc=university,dc=edu', 'pi002', '李教授', 'li@hpc.university.edu', '数学科学学院', '010-87654321')
ON CONFLICT (username) DO NOTHING;

-- 创建视图：PI的学生统计
CREATE OR REPLACE VIEW pi_student_stats AS
SELECT 
    p.id as pi_id,
    p.username as pi_username,
    p.full_name as pi_name,
    COUNT(s.id) as total_students,
    COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_students,
    COUNT(CASE WHEN s.status = 'pending' THEN 1 END) as pending_students
FROM pis p
LEFT JOIN students s ON p.id = s.pi_id
WHERE p.is_active = true
GROUP BY p.id, p.username, p.full_name;

-- 创建视图：申请统计
CREATE OR REPLACE VIEW request_stats AS
SELECT 
    p.id as pi_id,
    p.username as pi_username,
    COUNT(r.id) as total_requests,
    COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_requests,
    COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_requests,
    COUNT(CASE WHEN r.status = 'rejected' THEN 1 END) as rejected_requests
FROM pis p
LEFT JOIN requests r ON p.id = r.pi_id
WHERE p.is_active = true
GROUP BY p.id, p.username;

-- 授予权限（根据需要调整）
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO hpc_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO hpc_user;