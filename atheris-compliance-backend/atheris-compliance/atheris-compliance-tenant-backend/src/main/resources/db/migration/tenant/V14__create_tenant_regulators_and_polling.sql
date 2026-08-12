CREATE TABLE tenant_regulators (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(50),
    platform_regulator_id INT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tr_tenant ON tenant_regulators(tenant_id);
CREATE INDEX idx_tr_platform ON tenant_regulators(platform_regulator_id);

CREATE TABLE tenant_polling_config (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL UNIQUE,
    polling_interval_minutes INT DEFAULT 15,
    last_polled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tpc_tenant ON tenant_polling_config(tenant_id);

CREATE TABLE upload_jobs (
    id BIGSERIAL PRIMARY KEY,
    upload_id UUID NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL,
    tenant_regulator_id BIGINT REFERENCES tenant_regulators(id),
    title VARCHAR(500),
    platform_instrument_id BIGINT,
    platform_job_id BIGINT,
    status VARCHAR(20) DEFAULT 'queued',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_uj_tenant ON upload_jobs(tenant_id);
CREATE INDEX idx_uj_upload_id ON upload_jobs(upload_id);
CREATE INDEX idx_uj_status ON upload_jobs(status);

ALTER TABLE regulatory_returns
    ADD CONSTRAINT fk_returns_regulator
    FOREIGN KEY (tenant_regulator_id) REFERENCES tenant_regulators(id);

CREATE INDEX idx_returns_regulator ON regulatory_returns(tenant_regulator_id);

UPDATE regulatory_returns SET tenant_regulator_id = (
    SELECT tr.id FROM tenant_regulators tr
    WHERE tr.tenant_id = 1
      AND tr.is_active = true
      AND (LOWER(COALESCE(tr.abbreviation, '')) = LOWER(COALESCE(regulatory_returns.filing_regulator, ''))
           OR LOWER(tr.name) = LOWER(COALESCE(regulatory_returns.filing_regulator, '')))
    LIMIT 1
) WHERE tenant_regulator_id IS NULL AND filing_regulator IS NOT NULL;

