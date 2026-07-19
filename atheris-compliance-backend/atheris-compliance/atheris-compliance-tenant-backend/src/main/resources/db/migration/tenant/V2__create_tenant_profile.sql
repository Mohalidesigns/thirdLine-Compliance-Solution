CREATE TABLE IF NOT EXISTS tenant_profile (
    profile_id                 SERIAL PRIMARY KEY,
    tenant_id                  BIGINT NOT NULL,
    legal_name                 VARCHAR(500) NOT NULL,
    short_name                 VARCHAR(100),
    licence_type               VARCHAR(100) NOT NULL,
    licence_number             VARCHAR(100),
    state_of_hq                VARCHAR(100),
    employee_count             INT,
    subscribed_regulators      JSONB,
    subscribed_document_types  JSONB,
    notification_risk_ratings  JSONB,
    product_lines              JSONB,
    notification_frequency     VARCHAR(50) DEFAULT 'immediate',
    cco_name                   VARCHAR(255),
    cco_email                  VARCHAR(255),
    tech_email                 VARCHAR(255),
    webhook_url                TEXT,
    webhook_enabled            BOOLEAN DEFAULT true,
    subscription_tier          VARCHAR(50) DEFAULT 'starter',
    address                    TEXT,
    contact_phone              VARCHAR(50),
    contact_email              VARCHAR(255),
    is_active                  BOOLEAN DEFAULT true,
    onboarding_step            INT DEFAULT 1,
    onboarding_completed_at    TIMESTAMP WITH TIME ZONE,
    encrypted_api_key          TEXT,
    api_key_prefix             VARCHAR(16),
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tenant_profile_tenant ON tenant_profile(tenant_id);

CREATE TABLE IF NOT EXISTS tenant_regulator_preferences (
    preference_id                 SERIAL PRIMARY KEY,
    regulator_id                  INT NOT NULL,
    is_subscribed                 BOOLEAN DEFAULT true,
    document_types_override       JSONB,
    notification_frequency_override VARCHAR(50),
    updated_by_user_id            INT,
    created_at                    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_regulator_prefs_id ON tenant_regulator_preferences(regulator_id);
