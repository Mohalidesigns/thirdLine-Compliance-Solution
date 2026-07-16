ALTER TABLE tenant_profile
    ADD COLUMN IF NOT EXISTS license_key                  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS license_status               VARCHAR(50) DEFAULT 'inactive',
    ADD COLUMN IF NOT EXISTS license_activated_at         TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS intelligence_enabled         BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS device_fingerprint           VARCHAR(128),
    ADD COLUMN IF NOT EXISTS device_fingerprint_provisioned_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_license_checkup_at      TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS license_grace_period_end     TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS auth_type                    VARCHAR(50) DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS ldap_config                  JSONB;

CREATE INDEX IF NOT EXISTS idx_tenant_profile_license_key ON tenant_profile(license_key);
