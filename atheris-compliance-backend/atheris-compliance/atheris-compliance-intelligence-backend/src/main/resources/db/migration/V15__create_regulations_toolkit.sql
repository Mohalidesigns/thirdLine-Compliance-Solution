-- Phase A: Nigerian Compliance Toolkit — act parent entity + universe curation

CREATE TABLE IF NOT EXISTS areas_of_focus (
    area_id     BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS acts (
    act_id              BIGSERIAL PRIMARY KEY,
    name                VARCHAR(500) NOT NULL,
    abbreviation        VARCHAR(50),
    description         TEXT,
    regulator_id        INT REFERENCES regulators(regulator_id),
    canonical_instrument_id BIGINT REFERENCES instruments(instrument_id),
    status              VARCHAR(50) DEFAULT 'Active',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_acts_name ON acts(name);

CREATE TABLE IF NOT EXISTS act_aliases (
    alias_id    BIGSERIAL PRIMARY KEY,
    alias       VARCHAR(500) NOT NULL,
    act_id      BIGINT NOT NULL REFERENCES acts(act_id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_act_aliases_alias ON act_aliases(alias);

-- Enrich instruments with toolkit curation columns
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS act_id   BIGINT REFERENCES acts(act_id);
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS regulatory_item_type VARCHAR(100);
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS comment_on_status    TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS risk_rating_explanation TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS commercial_bank_relevance TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS commercial_bank_compliance_context TEXT;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS applicability_to_commercial_banks VARCHAR(20);
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS document_url TEXT;

CREATE INDEX idx_instruments_act ON instruments(act_id);

-- Link obligations + sanctions to acts too
ALTER TABLE obligation_mappings ADD COLUMN IF NOT EXISTS act_id BIGINT REFERENCES acts(act_id);
ALTER TABLE sanctions_and_penalties ADD COLUMN IF NOT EXISTS act_id BIGINT REFERENCES acts(act_id);

-- Enrich sanctions with the laws-grid impact/penalty detail columns
ALTER TABLE sanctions_and_penalties ADD COLUMN IF NOT EXISTS risk_explanation TEXT;
ALTER TABLE sanctions_and_penalties ADD COLUMN IF NOT EXISTS penalty_details TEXT;

CREATE INDEX IF NOT EXISTS idx_obligation_mappings_act ON obligation_mappings(act_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_act ON sanctions_and_penalties(act_id);

-- Phase C: regulatory returns register (from the toolkit Returns & Remittance section)
CREATE TABLE IF NOT EXISTS regulatory_returns (
    return_id            BIGSERIAL PRIMARY KEY,
    act_id               BIGINT REFERENCES acts(act_id),
    instrument_id        BIGINT REFERENCES instruments(instrument_id),
    title                VARCHAR(500) NOT NULL,
    section_reference    VARCHAR(255),
    statutory_basis      TEXT,
    responsible_unit     VARCHAR(255),
    responsible_person   VARCHAR(255),
    frequency            VARCHAR(255),
    deadline             TEXT,
    remarks              TEXT,
    filing_date          DATE,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_act ON regulatory_returns(act_id);
CREATE INDEX IF NOT EXISTS idx_returns_instrument ON regulatory_returns(instrument_id);

-- Seed the 28 Areas of Focus from the toolkit
INSERT INTO areas_of_focus (name) VALUES
    ('Payment Management Systems'),
    ('AML/CFT/CPF'),
    ('Foreign Exchange Operations'),
    ('Credit Risk'),
    ('People and Conduct Risk'),
    ('Corporate Governance'),
    ('Account Management'),
    ('Foreign Trading'),
    ('Tax Compliance'),
    ('Risk Management'),
    ('Cash Management'),
    ('Monetary Policy'),
    ('Consumer Protection'),
    ('Others'),
    ('International Money Transfer Services'),
    ('Trade Compliance'),
    ('Liquidity Management'),
    ('Capital Adequacy'),
    ('Anti-Bribery & Corruption'),
    ('Cybersecurity'),
    ('Capital Market Operations'),
    ('Financial Inclusion'),
    ('Mobile Banking Operations'),
    ('Financial Reporting'),
    ('Licensing & Permissible Activities'),
    ('Data Protection'),
    ('Fraud Management'),
    ('ESG')
ON CONFLICT (name) DO NOTHING;