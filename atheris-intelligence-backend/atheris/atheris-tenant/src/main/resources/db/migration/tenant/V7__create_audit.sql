CREATE TABLE IF NOT EXISTS audit_events (
    event_id            BIGSERIAL PRIMARY KEY,
    actor_user_id       INT,
    action              VARCHAR(255) NOT NULL,
    subject_type        VARCHAR(100),
    subject_id          BIGINT,
    before_json         TEXT,
    after_json          TEXT,
    evidence_url        TEXT,
    previous_event_id   BIGINT,
    previous_event_hash VARCHAR(64) NOT NULL,
    this_event_hash     VARCHAR(64) NOT NULL,
    occurred_at         TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_audit_subject ON audit_events(subject_type, subject_id, occurred_at DESC);
CREATE INDEX idx_audit_occurred ON audit_events(occurred_at DESC);
