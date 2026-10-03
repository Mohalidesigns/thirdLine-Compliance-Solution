CREATE TABLE IF NOT EXISTS import_batches (
    batch_id            BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT,
    entity_type         VARCHAR(50)  NOT NULL,
    file_name           VARCHAR(255),
    status              VARCHAR(20)  NOT NULL DEFAULT 'previewed',
    total_rows          INT          NOT NULL DEFAULT 0,
    valid_rows          INT          NOT NULL DEFAULT 0,
    invalid_rows        INT          NOT NULL DEFAULT 0,
    duplicate_rows      INT          NOT NULL DEFAULT 0,
    imported_rows       INT          NOT NULL DEFAULT 0,
    rows                JSONB,
    created_by_user_id  INT,
    created_by_name     TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    committed_at        TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_import_batches_type_created ON import_batches(entity_type, created_at DESC);
