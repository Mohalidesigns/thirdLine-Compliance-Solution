CREATE TABLE IF NOT EXISTS platform_audit_log (
    log_id       BIGSERIAL    PRIMARY KEY,
    actor_id     INT,
    actor_type   VARCHAR(50)  DEFAULT 'user',
    action       VARCHAR(100) NOT NULL,
    subject_type VARCHAR(50),
    subject_id   BIGINT,
    metadata_json JSONB,
    occurred_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_action     ON platform_audit_log(action, occurred_at DESC);
CREATE INDEX idx_audit_subject    ON platform_audit_log(subject_type, subject_id);
CREATE INDEX idx_audit_actor      ON platform_audit_log(actor_id, occurred_at DESC);
