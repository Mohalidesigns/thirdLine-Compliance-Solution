CREATE TABLE tenant_compliance_settings (
    id                      BIGSERIAL PRIMARY KEY,
    tenant_id               BIGINT NOT NULL UNIQUE,
    residual_all_drop       INTEGER NOT NULL DEFAULT 2,
    residual_majority_drop  INTEGER NOT NULL DEFAULT 1,
    residual_axis           VARCHAR(20) NOT NULL DEFAULT 'LIKELIHOOD',
    residual_target         VARCHAR(30) NOT NULL DEFAULT 'Passed',
    residual_floor          INTEGER NOT NULL DEFAULT 1,
    control_due_soon_days   INTEGER NOT NULL DEFAULT 30,
    finding_due_soon_days   INTEGER NOT NULL DEFAULT 7,
    sla_critical_days       INTEGER NOT NULL DEFAULT 1,
    sla_high_days           INTEGER NOT NULL DEFAULT 14,
    sla_medium_days         INTEGER NOT NULL DEFAULT 30,
    sla_low_days            INTEGER NOT NULL DEFAULT 60,
    require_control_test_review BOOLEAN NOT NULL DEFAULT TRUE,
    require_finding_review      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenant_compliance_settings_tenant ON tenant_compliance_settings(tenant_id);
