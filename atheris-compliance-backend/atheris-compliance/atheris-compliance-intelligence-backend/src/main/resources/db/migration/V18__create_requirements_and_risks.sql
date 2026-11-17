-- Toolkit enrichment: first-class requirements.
-- Requirements are the distinct enforceable duties of an obligation; each links to the toolkit
-- controls (from its row's primary/additional control) that satisfy it.

CREATE TABLE IF NOT EXISTS obligation_requirements (
    requirement_id  BIGSERIAL PRIMARY KEY,
    obligation_id   BIGINT NOT NULL REFERENCES obligation_mappings(obligation_id) ON DELETE CASCADE,
    ordinal         INT NOT NULL,
    text            TEXT NOT NULL,
    source          VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (obligation_id, ordinal)
);

CREATE INDEX idx_requirements_obligation ON obligation_requirements(obligation_id);

CREATE TABLE IF NOT EXISTS requirement_controls (
    requirement_id BIGINT NOT NULL REFERENCES obligation_requirements(requirement_id) ON DELETE CASCADE,
    control_id     INT    NOT NULL REFERENCES compliance_controls(compliance_control_id) ON DELETE CASCADE,
    PRIMARY KEY (requirement_id, control_id)
);

CREATE INDEX idx_requirement_controls_control ON requirement_controls(control_id);