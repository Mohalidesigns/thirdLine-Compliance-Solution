CREATE TABLE IF NOT EXISTS pending_downloads (
    id                BIGSERIAL PRIMARY KEY,
    regulator_id      INTEGER      NOT NULL REFERENCES regulators(regulator_id),
    source_url        TEXT         NOT NULL,
    source_page_url   TEXT,
    title             VARCHAR(500),
    discovered_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status            VARCHAR(20)  NOT NULL DEFAULT 'pending',
    s3_key            VARCHAR(500),
    error_message     TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pending_downloads_status ON pending_downloads(status);
CREATE INDEX idx_pending_downloads_regulator ON pending_downloads(regulator_id);
