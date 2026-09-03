CREATE TABLE IF NOT EXISTS risk_matrix_config (
    id                    BIGSERIAL PRIMARY KEY,
    tenant_id             BIGINT NOT NULL UNIQUE,
    impact_levels         JSONB NOT NULL DEFAULT '["Insignificant","Minor","Moderate","Major","Severe"]',
    likelihood_levels     JSONB NOT NULL DEFAULT '["Rare","Unlikely","Possible","Likely","Almost Certain"]',
    scoring_formula       VARCHAR(20) DEFAULT 'product',
    band_thresholds       JSONB DEFAULT '{"moderate":6,"high":12,"critical":18}',
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE tenant_profile ADD COLUMN IF NOT EXISTS auto_subscribe_regulators BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tenant_profile ADD COLUMN IF NOT EXISTS auto_seed_obligations BOOLEAN NOT NULL DEFAULT false;
