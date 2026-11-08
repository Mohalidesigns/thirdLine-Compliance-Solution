CREATE TABLE tenant_polling_config (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL UNIQUE,
    polling_interval_minutes INT DEFAULT 15,
    last_polled_at TIMESTAMP,
    task_control_horizon_days INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON COLUMN tenant_polling_config.task_control_horizon_days IS
    'Task Centre control-test look-ahead in days; 0 = use each control''s own test cadence.';

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