INSERT INTO cors_whitelist (origin, description, is_active) VALUES
    ('http://localhost:5174', 'Tenant frontend dev server', true)
ON CONFLICT (origin) DO NOTHING;
