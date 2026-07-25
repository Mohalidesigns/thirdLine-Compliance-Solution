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

CREATE TABLE IF NOT EXISTS evidence_files (
    file_id              BIGSERIAL PRIMARY KEY,
    file_name            VARCHAR(500) NOT NULL,
    original_name        VARCHAR(500) NOT NULL,
    mime_type            VARCHAR(100),
    file_size            BIGINT,
    storage_path         VARCHAR(1000) NOT NULL,
    source_type          VARCHAR(100),
    source_id            BIGINT,
    description          TEXT,
    uploaded_by_user_id  INT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_evidence_source ON evidence_files(source_type, source_id);
CREATE INDEX idx_evidence_uploaded ON evidence_files(created_at DESC);
