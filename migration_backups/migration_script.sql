-- HPC用户管理系统数据库迁移脚本
-- 从简单结构迁移到支持LDAP全量导入的新结构

-- 第一步：备份现有数据到临时表
CREATE TABLE temp_pis_backup AS SELECT * FROM pis;
CREATE TABLE temp_students_backup AS SELECT * FROM students;
CREATE TABLE temp_admins_backup AS SELECT * FROM admins;
CREATE TABLE temp_requests_backup AS SELECT * FROM requests;
CREATE TABLE temp_audit_logs_backup AS SELECT * FROM audit_logs;

-- 第二步：创建新的数据库结构
-- 注意：保持原有表的同时创建新表，确保数据不丢失

-- 1. 用户基础表 (从LDAP导入的所有用户)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    ldap_dn VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE NOT NULL,
    uid_number INTEGER UNIQUE,                 -- LDAP uid (POSIX账户)
    gid_number INTEGER,                        -- LDAP gid (课题组标识)
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    home_directory VARCHAR(255),               -- LDAP homeDirectory
    login_shell VARCHAR(100) DEFAULT '/bin/bash', -- LDAP loginShell
    user_type VARCHAR(20) DEFAULT 'unassigned', -- 'pi', 'student', 'unassigned'
    is_active BOOLEAN DEFAULT true,            -- 用户是否活跃
    is_deleted_from_ldap BOOLEAN DEFAULT false, -- LDAP中是否已删除
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 课题组表 (基于gid_number)
CREATE TABLE research_groups (
    id SERIAL PRIMARY KEY,
    gid_number INTEGER UNIQUE,                 -- 对应LDAP gid
    group_name VARCHAR(200) NOT NULL,
    description TEXT,
    pi_user_id INTEGER REFERENCES users(id),  -- 课题组PI
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 重命名现有表为legacy表
ALTER TABLE pis RENAME TO pis_legacy;
ALTER TABLE students RENAME TO students_legacy;

-- 4. 创建新的PI表 (关联users表)
CREATE TABLE pis (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id), -- 关联基础用户表
    department VARCHAR(200),
    office_location VARCHAR(100),
    research_area TEXT,
    max_students INTEGER DEFAULT 10,            -- 最大学生数限制
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 保留legacy字段以兼容现有代码
    ldap_dn VARCHAR(255),
    username VARCHAR(100),
    full_name VARCHAR(200),
    email VARCHAR(255),
    phone VARCHAR(50)
);

-- 5. 创建新的students表 (关联users表)
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id), -- 关联基础用户表
    pi_id INTEGER REFERENCES pis(id),           -- 所属PI
    student_id VARCHAR(50),                     -- 学号
    major VARCHAR(100),                         -- 专业
    enrollment_year INTEGER,                    -- 入学年份
    degree_level VARCHAR(20),                   -- 学位层次 (undergraduate/master/phd)
    status VARCHAR(20) DEFAULT 'active',       -- 'active', 'graduated', 'suspended'
    join_date DATE,                             -- 加入课题组日期
    expected_graduation DATE,                   -- 预期毕业时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 保留legacy字段以兼容现有代码
    username VARCHAR(100),
    chinese_name VARCHAR(200),
    email VARCHAR(255),
    phone VARCHAR(50),
    ldap_dn VARCHAR(255)
);

-- 6. 用户同步日志表
CREATE TABLE sync_logs (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(20) NOT NULL,              -- 'full', 'incremental'
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    updated_users INTEGER DEFAULT 0,
    deleted_users INTEGER DEFAULT 0,             -- LDAP中删除的用户数
    errors TEXT,                                  -- 错误信息JSON
    performed_by INTEGER,                         -- 执行人ID
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER
);

-- 第三步：数据迁移
-- 迁移现有PI用户数据
INSERT INTO users (
    ldap_dn, username, full_name, email, phone, 
    user_type, uid_number, gid_number, is_active
)
SELECT 
    ldap_dn, username, full_name, email, phone,
    'pi', 
    10000 + id, -- 临时分配uid_number
    1000,       -- 临时分配gid_number
    is_active
FROM pis_legacy;

-- 迁移PI关联数据
INSERT INTO pis (
    user_id, department, is_active, created_at, updated_at,
    ldap_dn, username, full_name, email, phone
)
SELECT 
    u.id, p.department, p.is_active, p.created_at, p.updated_at,
    p.ldap_dn, p.username, p.full_name, p.email, p.phone
FROM pis_legacy p
JOIN users u ON u.username = p.username;

-- 迁移现有学生用户数据
INSERT INTO users (
    ldap_dn, username, full_name, email, phone,
    user_type, uid_number, gid_number, is_active
)
SELECT 
    ldap_dn, username, chinese_name, email, phone,
    'student',
    20000 + id, -- 临时分配uid_number
    2000,       -- 临时分配gid_number
    CASE WHEN status = 'active' THEN true ELSE false END
FROM students_legacy;

-- 迁移学生关联数据
INSERT INTO students (
    user_id, pi_id, status, created_at, updated_at,
    username, chinese_name, email, phone, ldap_dn
)
SELECT 
    u.id, s.pi_id, s.status, s.created_at, s.updated_at,
    s.username, s.chinese_name, s.email, s.phone, s.ldap_dn
FROM students_legacy s
JOIN users u ON u.username = s.username;

-- 第四步：创建索引和约束
CREATE INDEX idx_users_uid_number ON users(uid_number);
CREATE INDEX idx_users_gid_number ON users(gid_number);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_is_deleted_from_ldap ON users(is_deleted_from_ldap);
CREATE INDEX idx_research_groups_gid_number ON research_groups(gid_number);
CREATE INDEX idx_students_pi_id ON students(pi_id);
CREATE INDEX idx_sync_logs_sync_type ON sync_logs(sync_type);

-- 添加约束
ALTER TABLE users ADD CONSTRAINT check_user_type 
    CHECK (user_type IN ('pi', 'student', 'unassigned'));

ALTER TABLE students ADD CONSTRAINT check_status_new
    CHECK (status IN ('active', 'graduated', 'suspended', 'pending', 'deleted'));

ALTER TABLE students ADD CONSTRAINT check_degree_level 
    CHECK (degree_level IN ('undergraduate', 'master', 'phd'));

-- 第五步：创建触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_research_groups_updated_at BEFORE UPDATE ON research_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pis_updated_at BEFORE UPDATE ON pis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 第六步：验证数据迁移
SELECT 'PI用户迁移验证' as check_type, 
       (SELECT COUNT(*) FROM pis_legacy) as original_count,
       (SELECT COUNT(*) FROM users WHERE user_type = 'pi') as migrated_count;

SELECT '学生用户迁移验证' as check_type,
       (SELECT COUNT(*) FROM students_legacy) as original_count, 
       (SELECT COUNT(*) FROM users WHERE user_type = 'student') as migrated_count;

-- 第七步：创建视图以保持向后兼容
CREATE VIEW pis_view AS
SELECT 
    p.id,
    u.ldap_dn,
    u.username,
    u.full_name,
    u.email,
    u.phone,
    p.department,
    p.is_active,
    p.created_at,
    p.updated_at,
    (SELECT COUNT(*) FROM students s WHERE s.pi_id = p.id) as student_count
FROM pis p
JOIN users u ON p.user_id = u.id;

CREATE VIEW students_view AS  
SELECT
    s.id,
    u.username,
    u.full_name as chinese_name,
    u.email,
    u.phone,
    s.pi_id,
    u.ldap_dn,
    s.status,
    s.created_at,
    s.updated_at,
    p.username as pi_username,
    pu.full_name as pi_name
FROM students s
JOIN users u ON s.user_id = u.id
LEFT JOIN pis p ON s.pi_id = p.id
LEFT JOIN users pu ON p.user_id = pu.id;