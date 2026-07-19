CREATE TABLE IF NOT EXISTS tenants (
    tenant_id              BIGSERIAL PRIMARY KEY,
    legal_name             VARCHAR(500) NOT NULL,
    short_name             VARCHAR(100),
    licence_type           VARCHAR(100),
    licence_number         VARCHAR(100),
    regulators                    JSONB,
    regulator_abbreviations        JSONB,
    product_lines          JSONB,
    subscribed_document_types JSONB,
    notification_frequency VARCHAR(50) DEFAULT 'immediate',
    employee_count         INT,
    state_of_hq            VARCHAR(100),
    address                TEXT,
    contact_phone          VARCHAR(50),
    contact_email          VARCHAR(255),
    cco_name               VARCHAR(255),
    cco_email              VARCHAR(255),
    tech_email             VARCHAR(255),
    webhook_url            TEXT,
    webhook_secret         VARCHAR(255),
    webhook_enabled        BOOLEAN DEFAULT true,
    subscription_tier      VARCHAR(50) DEFAULT 'starter',
    is_active              BOOLEAN DEFAULT true,
    onboarded_by           INT,
    onboarded_at           TIMESTAMP WITH TIME ZONE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_delivery_log (
    delivery_id         BIGSERIAL PRIMARY KEY,
    webhook_id          VARCHAR(100) UNIQUE,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(tenant_id),
    instrument_id       BIGINT,
    webhook_type        VARCHAR(100),
    status              VARCHAR(50) DEFAULT 'pending',
    request_payload     JSONB,
    request_signature   VARCHAR(128),
    response_code       INT,
    response_body       TEXT,
    delivery_latency_ms INT,
    attempt_count       INT DEFAULT 0,
    max_attempts        INT DEFAULT 5,
    last_error          TEXT,
    next_retry_at       TIMESTAMP WITH TIME ZONE,
    delivered_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_delivery_tenant  ON webhook_delivery_log(tenant_id, created_at DESC);
CREATE INDEX idx_webhook_delivery_retry   ON webhook_delivery_log(status, next_retry_at)
    WHERE status = 'failed';
