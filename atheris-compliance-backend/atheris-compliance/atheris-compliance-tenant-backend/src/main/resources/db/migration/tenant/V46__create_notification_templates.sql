CREATE TABLE IF NOT EXISTS notification_templates (
    template_id         BIGSERIAL PRIMARY KEY,
    template_key        VARCHAR(100) NOT NULL UNIQUE,
    channel             VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
    subject             VARCHAR(500),
    body                TEXT,
    cc_owner            BOOLEAN NOT NULL DEFAULT TRUE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_user_id  INT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
