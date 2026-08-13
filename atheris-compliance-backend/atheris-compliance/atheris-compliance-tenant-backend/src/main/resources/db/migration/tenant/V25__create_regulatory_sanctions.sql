CREATE TABLE IF NOT EXISTS regulatory_sanctions (
    sanction_id             BIGSERIAL PRIMARY KEY,
    instrument_id           BIGINT NOT NULL,
    regulation_id           BIGINT,
    regulation_name         VARCHAR(500),
    sanction_type           VARCHAR(100),
    sanction_amount_naira   NUMERIC(15,2),
    sanction_amount_per_day BOOLEAN DEFAULT FALSE,
    liable_roles            JSONB,
    severity_score          INTEGER,
    has_been_enforced       BOOLEAN DEFAULT FALSE,
    description             TEXT,
    source_section_reference VARCHAR(255),
    risk_explanation        TEXT,
    penalty_details         TEXT,
    created_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reg_sanctions_instrument ON regulatory_sanctions (instrument_id);