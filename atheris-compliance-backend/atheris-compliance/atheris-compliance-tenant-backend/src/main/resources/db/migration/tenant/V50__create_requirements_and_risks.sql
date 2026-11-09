-- First-class risks and requirements (seeded from the platform toolkit, editable by the tenant).
-- A requirement is one enforceable duty of an obligation. Compliance state is derived from the
-- latest test result of the controls linked to it; a requirement with no control is a gap.

CREATE TABLE IF NOT EXISTS risks (
    risk_id             SERIAL PRIMARY KEY,
    risk_code           VARCHAR(40) NOT NULL UNIQUE,
    name                VARCHAR(300) NOT NULL,
    description         TEXT,
    risk_type           VARCHAR(60),
    area_of_focus       VARCHAR(120),
    inherent_likelihood VARCHAR(40),
    inherent_impact     VARCHAR(40),
    inherent_band       VARCHAR(40),
    owner_id            INT REFERENCES owners(owner_id),
    department_id       INT REFERENCES departments(department_id),
    team_id             INT REFERENCES teams(team_id),
    status              VARCHAR(30) DEFAULT 'Active',
    source              VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_risks_area ON risks(area_of_focus);
CREATE INDEX idx_risks_owner ON risks(owner_id);
CREATE INDEX idx_risks_department ON risks(department_id);

CREATE TABLE IF NOT EXISTS requirements (
    requirement_id  BIGSERIAL PRIMARY KEY,
    obligation_id   BIGINT NOT NULL REFERENCES obligations(obligation_id) ON DELETE CASCADE,
    ordinal         INT NOT NULL,
    text            TEXT NOT NULL,
    risk_id         INT REFERENCES risks(risk_id),
    state_override  VARCHAR(30),
    override_reason TEXT,
    source          VARCHAR(30) DEFAULT 'toolkit_seed',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (obligation_id, ordinal)
);

CREATE INDEX idx_requirements_obligation ON requirements(obligation_id);
CREATE INDEX idx_requirements_risk ON requirements(risk_id);

CREATE TABLE IF NOT EXISTS requirement_controls (
    requirement_id BIGINT NOT NULL REFERENCES requirements(requirement_id) ON DELETE CASCADE,
    control_id     INT    NOT NULL REFERENCES controls(control_id) ON DELETE CASCADE,
    PRIMARY KEY (requirement_id, control_id)
);

CREATE INDEX idx_requirement_controls_control ON requirement_controls(control_id);

CREATE TABLE IF NOT EXISTS risk_controls (
    risk_id    INT NOT NULL REFERENCES risks(risk_id) ON DELETE CASCADE,
    control_id INT NOT NULL REFERENCES controls(control_id) ON DELETE CASCADE,
    PRIMARY KEY (risk_id, control_id)
);

CREATE INDEX idx_risk_controls_control ON risk_controls(control_id);

CREATE TABLE IF NOT EXISTS risk_obligations (
    risk_id       INT    NOT NULL REFERENCES risks(risk_id) ON DELETE CASCADE,
    obligation_id BIGINT NOT NULL REFERENCES obligations(obligation_id) ON DELETE CASCADE,
    PRIMARY KEY (risk_id, obligation_id)
);

CREATE INDEX idx_risk_obligations_obligation ON risk_obligations(obligation_id);