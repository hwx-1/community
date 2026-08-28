-- 001_init: 账号、资料、学生身份认证、权限基础表
-- 版本化迁移，生产可追溯，不依赖启动时自动变更。

-- 账号：手机号唯一，密码 Argon2id 哈希
CREATE TABLE accounts (
    id            BIGSERIAL PRIMARY KEY,
    phone         VARCHAR(20)  NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    nickname      VARCHAR(16)  NOT NULL UNIQUE,          -- 昵称唯一，2-16 字
    status        VARCHAR(16)  NOT NULL DEFAULT 'active', -- active / banned
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT nickname_len CHECK (char_length(nickname) BETWEEN 2 AND 16)
);

-- 用户资料：公开资料与内部资料分开存储，内部字段不进入公开接口
CREATE TABLE profiles (
    account_id   BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    avatar_url   TEXT,
    gender       VARCHAR(8),
    real_name    VARCHAR(32),   -- 内部资料
    student_no   VARCHAR(32),   -- 内部资料
    class_name   VARCHAR(64),   -- 内部资料
    profile_done BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 学生身份认证：人工审核，驳回可补交重审
CREATE TABLE student_verifications (
    id            BIGSERIAL PRIMARY KEY,
    account_id    BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status        VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending / approved / rejected
    material_url  TEXT,                                     -- 证明材料私有存储，30 天后清理
    reject_reason TEXT,
    reviewed_by   BIGINT,
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_verif_account ON student_verifications(account_id);

-- 学号绑定：同一学号同一时刻只允许绑定一个已认证账号
CREATE TABLE student_bindings (
    student_no VARCHAR(32) PRIMARY KEY,
    account_id BIGINT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    bound_by   BIGINT NOT NULL,
    reason     TEXT,
    bound_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 角色与权限：权限点独立授予，徽标不自动授予权限
CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(32) NOT NULL UNIQUE,
    is_super    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id   BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE  -- 权限点，如 verify.review / dm.read
);

CREATE TABLE role_permissions (
    role_id       BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE account_roles (
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role_id    BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by BIGINT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, role_id)
);

-- 后台操作日志：仅追加，无 UPDATE/DELETE 接口
CREATE TABLE admin_audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    operator_id BIGINT NOT NULL,
    action      VARCHAR(64) NOT NULL,
    target_type VARCHAR(32),
    target_id   VARCHAR(64),
    result      VARCHAR(16),
    reason      TEXT,
    request_id  VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_time ON admin_audit_logs(created_at);
