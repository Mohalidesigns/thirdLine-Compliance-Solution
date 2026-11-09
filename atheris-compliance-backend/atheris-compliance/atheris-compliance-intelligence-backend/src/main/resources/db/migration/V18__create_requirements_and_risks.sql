-- Toolkit enrichment: first-class requirements + risk register.
-- Requirements are the distinct enforceable duties of an obligation; each links to the toolkit
-- controls (from its row's primary/additional control) that satisfy it, and to one risk. Risks are
-- a curated catalogue; risk↔obligation and risk↔control links are derived from the requirement map.

CREATE TABLE IF NOT EXISTS risks (
    risk_id             SERIAL PRIMARY KEY,
    code                VARCHAR(40) NOT NULL UNIQUE,
    name                VARCHAR(300) NOT NULL,
    description         TEXT,
    risk_type           VARCHAR(60),
    area_of_focus       VARCHAR(120),
    inherent_likelihood VARCHAR(40),
    inherent_impact     VARCHAR(40),
    inherent_band       VARCHAR(40),
    source              VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_risks_code ON risks(code);
CREATE INDEX idx_risks_area ON risks(area_of_focus);

CREATE TABLE IF NOT EXISTS obligation_requirements (
    requirement_id  BIGSERIAL PRIMARY KEY,
    obligation_id   BIGINT NOT NULL REFERENCES obligation_mappings(obligation_id) ON DELETE CASCADE,
    ordinal         INT NOT NULL,
    text            TEXT NOT NULL,
    risk_id         INT REFERENCES risks(risk_id),
    source          VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (obligation_id, ordinal)
);

CREATE INDEX idx_requirements_obligation ON obligation_requirements(obligation_id);
CREATE INDEX idx_requirements_risk ON obligation_requirements(risk_id);

CREATE TABLE IF NOT EXISTS requirement_controls (
    requirement_id BIGINT NOT NULL REFERENCES obligation_requirements(requirement_id) ON DELETE CASCADE,
    control_id     INT    NOT NULL REFERENCES compliance_controls(compliance_control_id) ON DELETE CASCADE,
    PRIMARY KEY (requirement_id, control_id)
);

CREATE INDEX idx_requirement_controls_control ON requirement_controls(control_id);

CREATE TABLE IF NOT EXISTS risk_obligations (
    risk_id       INT    NOT NULL REFERENCES risks(risk_id) ON DELETE CASCADE,
    obligation_id BIGINT NOT NULL REFERENCES obligation_mappings(obligation_id) ON DELETE CASCADE,
    PRIMARY KEY (risk_id, obligation_id)
);

CREATE INDEX idx_risk_obligations_obligation ON risk_obligations(obligation_id);

CREATE TABLE IF NOT EXISTS risk_controls (
    risk_id    INT NOT NULL REFERENCES risks(risk_id) ON DELETE CASCADE,
    control_id INT NOT NULL REFERENCES compliance_controls(compliance_control_id) ON DELETE CASCADE,
    PRIMARY KEY (risk_id, control_id)
);

CREATE INDEX idx_risk_controls_control ON risk_controls(control_id);