-- Acts explored by the tenant: one row per platform regulation (act), seeded from the
-- platform regulation seed so the tenant can browse acts and their linked obligations,
-- controls, returns and sanctions.
CREATE TABLE IF NOT EXISTS acts (
    act_id                   SERIAL PRIMARY KEY,
    regulation_id            BIGINT NOT NULL UNIQUE,   -- platform act id
    canonical_instrument_id  BIGINT,                   -- platform instrument anchoring the act's obligations
    name                     TEXT NOT NULL,
    abbreviation             VARCHAR(50),
    regulator_id             INT,
    regulator_name           TEXT,
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_acts_regulation ON acts(regulation_id);
CREATE INDEX idx_acts_name ON acts(name);
