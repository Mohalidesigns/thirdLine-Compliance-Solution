CREATE TABLE IF NOT EXISTS tenant_eligibility_rules (
    rule_id                    BIGSERIAL   PRIMARY KEY,
    instrument_id              BIGINT      NOT NULL REFERENCES instruments(instrument_id),
    rule_condition             TEXT,
    target_tenant_count        INT,
    should_route               BOOLEAN     DEFAULT true,
    route_with_confidence_level VARCHAR(50),
    route_with_review_flag     BOOLEAN     DEFAULT false,
    last_evaluated_at          TIMESTAMP WITH TIME ZONE,
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_eligibility_instrument ON tenant_eligibility_rules(instrument_id);
