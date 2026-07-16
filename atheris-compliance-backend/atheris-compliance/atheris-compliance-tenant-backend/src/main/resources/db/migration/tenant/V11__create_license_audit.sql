CREATE TABLE IF NOT EXISTS license_audit_log (
    id                  SERIAL PRIMARY KEY,
    event_type          VARCHAR(50) NOT NULL,
    license_key         VARCHAR(64),
    status              VARCHAR(50),
    device_fingerprint  VARCHAR(128),
    response_data       JSONB,
    ip_address          VARCHAR(45),
    user_agent          TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_license_audit_event ON license_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_license_audit_created ON license_audit_log(created_at);
