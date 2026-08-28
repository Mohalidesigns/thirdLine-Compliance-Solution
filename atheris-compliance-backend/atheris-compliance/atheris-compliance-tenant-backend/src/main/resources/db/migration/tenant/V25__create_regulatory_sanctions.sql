CREATE TABLE IF NOT EXISTS regulatory_sanctions (
    sanction_id             BIGSERIAL PRIMARY KEY,
    instrument_id           BIGINT NOT NULL,
    act_id                  BIGINT,
    act_name                TEXT,
    sanction_type           VARCHAR(100),
    sanction_amount_naira   NUMERIC(15,2),
    sanction_amount_per_day BOOLEAN DEFAULT FALSE,
    liable_roles            JSONB,
    severity_score          INTEGER,
    has_been_enforced       BOOLEAN DEFAULT FALSE,
    description             TEXT,
    source_section_reference TEXT,
    risk_explanation        TEXT,
    penalty_details         TEXT,
    created_at              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reg_sanctions_instrument ON regulatory_sanctions (instrument_id);