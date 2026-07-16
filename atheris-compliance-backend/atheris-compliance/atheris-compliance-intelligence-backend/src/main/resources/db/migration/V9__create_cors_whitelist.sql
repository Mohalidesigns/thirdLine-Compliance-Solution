CREATE TABLE IF NOT EXISTS cors_whitelist (
    id          BIGSERIAL    PRIMARY KEY,
    origin      VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active   BOOLEAN      DEFAULT true,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default development origins
INSERT INTO cors_whitelist (origin, description, is_active) VALUES
    ('http://localhost:5173', 'Vite dev server', true),
    ('http://localhost:9090', 'Backend self-origin', true)
ON CONFLICT (origin) DO NOTHING;

CREATE INDEX idx_cors_whitelist_active ON cors_whitelist(is_active);
