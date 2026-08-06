CREATE TABLE IF NOT EXISTS pending_reviews (
    review_id              BIGSERIAL PRIMARY KEY,
    tenant_id              BIGINT NOT NULL,
    source                 VARCHAR(20) DEFAULT 'intel',
    instrument_id          BIGINT,
    upload_id              UUID,
    source_title           VARCHAR(255),
    source_reference_number VARCHAR(255),
    regulator_id           INT,
    regulator_name         VARCHAR(255),
    regulator_abbreviation VARCHAR(50),
    document_type          VARCHAR(100),
    risk_rating            VARCHAR(50),
    date_issued            DATE,
    effective_date         DATE,
    published_at           DATE,
    pdf_url                VARCHAR(500),
    obligations_json       JSONB,
    status                 VARCHAR(20) DEFAULT 'pending',
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pending_reviews_tenant_status ON pending_reviews(tenant_id, status);
CREATE INDEX idx_pending_reviews_tenant_source ON pending_reviews(tenant_id, source);
