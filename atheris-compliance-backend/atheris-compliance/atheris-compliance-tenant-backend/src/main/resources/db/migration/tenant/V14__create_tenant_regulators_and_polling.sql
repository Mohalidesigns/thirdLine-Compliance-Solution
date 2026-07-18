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
    tenant_regulator_id BIGINT NOT NULL REFERENCES tenant_regulators(id),
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
