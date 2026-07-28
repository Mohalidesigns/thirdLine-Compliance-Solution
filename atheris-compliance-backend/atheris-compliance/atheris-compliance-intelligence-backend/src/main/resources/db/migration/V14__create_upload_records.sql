CREATE TABLE IF NOT EXISTS upload_records (
    id                 BIGSERIAL PRIMARY KEY,
    tenant_id          INT,
    user_id            INT,
    original_filename  VARCHAR(500) NOT NULL,
    title              VARCHAR(500) NOT NULL,
    regulator_id       INT REFERENCES regulators(regulator_id),
    document_type      VARCHAR(100),
    sha256_hash        VARCHAR(64) NOT NULL,
    s3_key             VARCHAR(500),
    extracted_text     TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'pending',
    instrument_id      BIGINT REFERENCES instruments(instrument_id),
    error_message      TEXT,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_upload_records_hash ON upload_records(sha256_hash);
CREATE INDEX idx_upload_records_status    ON upload_records(status);
CREATE INDEX idx_upload_records_tenant    ON upload_records(tenant_id);
