-- HPC用户管理系统 - 新数据库设计
-- 支持从生产LDAP导入用户并进行角色分配

-- 1. 用户基础表 (从LDAP导入的所有用户)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    ldap_dn VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    uid_number INTEGER UNIQUE NOT NULL,        -- LDAP uid (POSIX账户)
    gid_number INTEGER NOT NULL,               -- LDAP gid (课题组标识)
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    home_directory VARCHAR(255),               -- LDAP homeDirectory
    login_shell VARCHAR(100),                  -- LDAP loginShell
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
    gid_number INTEGER UNIQUE NOT NULL,        -- 对应LDAP gid
    group_name VARCHAR(200) NOT NULL,
    description TEXT,
    pi_user_id INTEGER REFERENCES users(id),  -- 课题组PI
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PI用户表 (用户角色为PI的用户)
CREATE TABLE pis (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id), -- 关联基础用户表
    department VARCHAR(200),
    office_location VARCHAR(100),
    research_area TEXT,
    max_students INTEGER DEFAULT 10,            -- 最大学生数限制
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 学生用户表 (用户角色为student的用户)
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. 申请表 (学生申请加入PI课题组)
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    student_user_id INTEGER REFERENCES users(id), -- 申请的学生用户
    pi_id INTEGER REFERENCES pis(id),             -- 目标PI
    request_type VARCHAR(20) DEFAULT 'join_group', -- 申请类型
    reason TEXT,                                   -- 申请理由
    status VARCHAR(20) DEFAULT 'pending',         -- 'pending', 'approved', 'rejected'
    reviewed_by INTEGER REFERENCES pis(id),      -- 审核人
    reviewed_at TIMESTAMP,
    review_comment TEXT,                          -- 审核意见
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. 管理员表 (系统管理员)
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),        -- 关联基础用户表 (可选)
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),                   -- 本地密码 (LDAP用户可为空)
    role VARCHAR(50) DEFAULT 'admin',            -- 'admin', 'super_admin'
    auth_type VARCHAR(20) DEFAULT 'ldap',       -- 'ldap', 'local'
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. 用户同步日志表
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

-- 8. 审计日志表
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,                -- 操作类型
    table_name VARCHAR(50),                      -- 操作的表名
    record_id INTEGER,                           -- 操作的记录ID
    old_values JSONB,                            -- 操作前的值
    new_values JSONB,                            -- 操作后的值
    performed_by INTEGER,                        -- 操作人ID
    ip_address INET,                             -- 操作IP
    user_agent TEXT,                             -- 用户代理
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引优化
CREATE INDEX idx_users_uid_number ON users(uid_number);
CREATE INDEX idx_users_gid_number ON users(gid_number);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_is_deleted_from_ldap ON users(is_deleted_from_ldap);
CREATE INDEX idx_research_groups_gid_number ON research_groups(gid_number);
CREATE INDEX idx_students_pi_id ON students(pi_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 约束
ALTER TABLE users ADD CONSTRAINT check_user_type 
    CHECK (user_type IN ('pi', 'student', 'unassigned'));

ALTER TABLE students ADD CONSTRAINT check_status 
    CHECK (status IN ('active', 'graduated', 'suspended'));

ALTER TABLE students ADD CONSTRAINT check_degree_level 
    CHECK (degree_level IN ('undergraduate', 'master', 'phd'));

ALTER TABLE requests ADD CONSTRAINT check_status 
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE requests ADD CONSTRAINT check_request_type 
    CHECK (request_type IN ('join_group', 'leave_group', 'change_pi'));

ALTER TABLE admins ADD CONSTRAINT check_role 
    CHECK (role IN ('admin', 'super_admin'));

ALTER TABLE admins ADD CONSTRAINT check_auth_type 
    CHECK (auth_type IN ('ldap', 'local'));

-- 触发器：自动更新 updated_at
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

CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 初始化系统管理员 (从配置文件读取)
-- 这个将在配置加载时动态插入