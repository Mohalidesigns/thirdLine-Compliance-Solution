CREATE TABLE IF NOT EXISTS users (
    user_id                SERIAL PRIMARY KEY,
    email                  VARCHAR(255) NOT NULL UNIQUE,
    full_name              VARCHAR(255) NOT NULL,
    job_title              VARCHAR(255),
    department             VARCHAR(255),
    password_hash          VARCHAR(255),
    role                   VARCHAR(50) NOT NULL,
    manager_user_id        INT,
    is_active              BOOLEAN DEFAULT true,
    email_verified         BOOLEAN DEFAULT false,
    invite_status          VARCHAR(50) DEFAULT 'pending',
    mfa_enabled            BOOLEAN DEFAULT false,
    mfa_secret             VARCHAR(255),
    failed_login_attempts  INT DEFAULT 0,
    locked_until           TIMESTAMP WITH TIME ZONE,
    invited_by_user_id     INT,
    invited_at             TIMESTAMP WITH TIME ZONE,
    last_login_at          TIMESTAMP WITH TIME ZONE,
    last_login_ip          VARCHAR(45),
    password_changed_at    TIMESTAMP WITH TIME ZONE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invite_tokens (
    token_id       SERIAL PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES users(user_id),
    token          TEXT,
    token_hash     VARCHAR(64) NOT NULL,
    token_type     VARCHAR(50) NOT NULL,
    is_used        BOOLEAN DEFAULT false,
    used_at        TIMESTAMP WITH TIME ZONE,
    expires_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by_user_id INT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id       SERIAL PRIMARY KEY,
    user_id        INT NOT NULL REFERENCES users(user_id),
    token_hash     VARCHAR(64) NOT NULL,
    device_name    VARCHAR(255),
    ip_address     VARCHAR(45),
    is_revoked     BOOLEAN DEFAULT false,
    revoked_reason VARCHAR(100),
    revoked_at     TIMESTAMP WITH TIME ZONE,
    expires_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at   TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id, is_revoked);
