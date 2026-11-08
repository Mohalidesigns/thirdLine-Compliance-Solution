-- Phase A: Nigerian Compliance Toolkit — act parent entity + universe curation
-- (acts / areas_of_focus / act_aliases live in V2, before instruments, so act_id FKs are inline.)

CREATE INDEX idx_instruments_act ON instruments(act_id);
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
    frequency_type       VARCHAR(20) DEFAULT 'MONTHLY',
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