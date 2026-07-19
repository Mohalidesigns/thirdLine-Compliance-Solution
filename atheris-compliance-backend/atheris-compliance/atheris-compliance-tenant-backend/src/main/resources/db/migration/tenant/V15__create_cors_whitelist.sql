CREATE TABLE IF NOT EXISTS cors_whitelist (
    id          BIGSERIAL    PRIMARY KEY,
    origin      VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active   BOOLEAN      DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO cors_whitelist (origin, description, is_active) VALUES
    ('http://localhost:5173', 'Intel frontend dev server', true),
    ('http://localhost:5174', 'Tenant frontend dev server', true),
    ('http://localhost:9091', 'Backend self-origin', true)
ON CONFLICT (origin) DO NOTHING;

CREATE INDEX idx_cors_whitelist_active ON cors_whitelist(is_active);
