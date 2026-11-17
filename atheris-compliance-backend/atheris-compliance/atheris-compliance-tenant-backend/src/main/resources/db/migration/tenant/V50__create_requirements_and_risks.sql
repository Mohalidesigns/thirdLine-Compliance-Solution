-- First-class requirements (seeded from the platform toolkit, editable by the tenant).
-- A requirement is one enforceable duty of an obligation. Compliance state is derived from the
-- latest test result of the controls linked to it; a requirement with no control is a gap.

CREATE TABLE IF NOT EXISTS requirements (
    requirement_id  BIGSERIAL PRIMARY KEY,
    obligation_id   BIGINT NOT NULL REFERENCES obligations(obligation_id) ON DELETE CASCADE,
    ordinal         INT NOT NULL,
    text            TEXT NOT NULL,
    state_override  VARCHAR(30),
    override_reason TEXT,
    source          VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (obligation_id, ordinal)
);

CREATE INDEX idx_requirements_obligation ON requirements(obligation_id);

CREATE TABLE IF NOT EXISTS requirement_controls (
    requirement_id BIGINT NOT NULL REFERENCES requirements(requirement_id) ON DELETE CASCADE,
    control_id     INT    NOT NULL REFERENCES controls(control_id) ON DELETE CASCADE,
    PRIMARY KEY (requirement_id, control_id)
);

CREATE INDEX idx_requirement_controls_control ON requirement_controls(control_id);