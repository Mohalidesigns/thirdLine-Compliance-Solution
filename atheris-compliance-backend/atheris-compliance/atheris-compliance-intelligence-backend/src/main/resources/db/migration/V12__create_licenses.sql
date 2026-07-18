CREATE TABLE IF NOT EXISTS licenses (
    id              SERIAL PRIMARY KEY,
    tenant_id       BIGINT REFERENCES tenants(tenant_id),
    license_key     VARCHAR(64) NOT NULL UNIQUE,
    tier            VARCHAR(50) NOT NULL DEFAULT 'custom',
    intelligence_enabled BOOLEAN NOT NULL DEFAULT true,
    max_users       INT NOT NULL DEFAULT 5,
    max_devices     INT NOT NULL DEFAULT 1,
    max_regulators  INT DEFAULT NULL,
    max_controls    INT DEFAULT NULL,
    max_returns     INT DEFAULT NULL,
    max_storage_mb  INT DEFAULT 500,
    device_fingerprint_enforced BOOLEAN NOT NULL DEFAULT true,
    status          VARCHAR(50) NOT NULL DEFAULT 'inactive',
    activated_at    TIMESTAMPTZ DEFAULT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    grace_period_days INT NOT NULL DEFAULT 7,
    grace_period_end TIMESTAMPTZ DEFAULT NULL,
    issued_by       INT DEFAULT NULL,
    notes           TEXT DEFAULT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS license_devices (
    id                  SERIAL PRIMARY KEY,
    license_id          INT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    device_fingerprint  VARCHAR(128) NOT NULL,
    device_label        VARCHAR(255) DEFAULT NULL,
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ip_address     VARCHAR(45) DEFAULT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(license_id, device_fingerprint)
);

CREATE INDEX idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX idx_licenses_license_key ON licenses(license_key);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_license_devices_license_id ON license_devices(license_id);

CREATE TABLE IF NOT EXISTS api_keys (
    id              SERIAL PRIMARY KEY,
    license_id      INT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    tenant_id       BIGINT REFERENCES tenants(tenant_id),
    key_hash        VARCHAR(64) NOT NULL,
    key_prefix      VARCHAR(16) NOT NULL,
    encrypted_key   TEXT NOT NULL,
    label           VARCHAR(100) DEFAULT 'default',
    is_active       BOOLEAN DEFAULT true,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_license ON api_keys(license_id);
