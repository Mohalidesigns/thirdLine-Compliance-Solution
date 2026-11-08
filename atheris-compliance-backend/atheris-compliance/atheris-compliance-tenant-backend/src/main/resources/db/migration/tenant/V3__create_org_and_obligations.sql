CREATE TABLE IF NOT EXISTS departments (
    department_id   SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL UNIQUE,
    code            VARCHAR(50)  UNIQUE,
    head_owner_id   INT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
    team_id        SERIAL PRIMARY KEY,
    department_id  INT NOT NULL REFERENCES departments(department_id),
    name           VARCHAR(255) NOT NULL,
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (department_id, name)
);

CREATE TABLE IF NOT EXISTS owners (
    owner_id       SERIAL PRIMARY KEY,
    full_name      VARCHAR(255) NOT NULL,
    email          VARCHAR(255),
    job_title      VARCHAR(255),
    team_id        INT REFERENCES teams(team_id),
    department_id  INT REFERENCES departments(department_id),
    user_id        INT,
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_teams_department   ON teams(department_id);
CREATE INDEX idx_owners_team        ON owners(team_id);
CREATE INDEX idx_owners_department  ON owners(department_id);
CREATE INDEX idx_owners_active      ON owners(is_active);

CREATE TABLE IF NOT EXISTS obligations (
    obligation_id            BIGSERIAL PRIMARY KEY,
    instrument_id           BIGINT,
    name                    TEXT,
    title                   TEXT,
    obligation_number       INT,
    description             TEXT,
    plain_english_statement TEXT,
    act_name                VARCHAR(500),
    regulation_id           BIGINT,
    section_reference       TEXT,
    area_of_focus           VARCHAR(100),
    obligation_type         VARCHAR(100),
    recurring_deadline_type VARCHAR(100),
    effective_date          DATE,
    status                  VARCHAR(50) DEFAULT 'active',
    source                  VARCHAR(50) DEFAULT 'ai_extracted',
    risk_description        TEXT,
    inherent_likelihood     VARCHAR(50),
    inherent_impact         VARCHAR(50),
    inherent_risk_rating    VARCHAR(50),
    control_owner           TEXT,
    tenant_regulator_id     BIGINT,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_obligations_instrument ON obligations(instrument_id);
CREATE INDEX idx_obligations_tenant_regulator ON obligations(tenant_regulator_id);

CREATE TABLE IF NOT EXISTS obligation_classifications (
    classification_id          BIGSERIAL PRIMARY KEY,
    instrument_id              BIGINT,
    obligation_id              BIGINT UNIQUE,
    applicability              VARCHAR(50) DEFAULT 'under_review',
    applicability_reasoning    TEXT,
    tenant_risk_rating         VARCHAR(50),
    risk_justification         TEXT,
    risk_type                  VARCHAR(50),
    impact_rating              VARCHAR(50),
    impact_justification       TEXT,
    likelihood_rating          VARCHAR(50),
    likelihood_justification    TEXT,
    inherent_risk_rating       VARCHAR(50),
    residual_risk_rating       VARCHAR(50),
    assigned_owner_user_id     INT,
    assigned_owner_name        TEXT,
    assigned_department        TEXT,
    assigned_owner_id          INT REFERENCES owners(owner_id),
    assigned_team_id           INT REFERENCES teams(team_id),
    assigned_department_id     INT REFERENCES departments(department_id),
    linked_control_ids         JSONB,
    classification_version     INT DEFAULT 1,
    classified_by_user_id      INT,
    classified_at              TIMESTAMP WITH TIME ZONE,

    status                     VARCHAR(50) DEFAULT 'unclassified',
    audit_hash                 VARCHAR(64),
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_obligation_class_status ON obligation_classifications(status);
CREATE INDEX idx_obligation_class_applicability ON obligation_classifications(applicability);
CREATE INDEX idx_obligation_class_owner ON obligation_classifications(assigned_owner_id);

CREATE TABLE IF NOT EXISTS classification_history (
    history_id               BIGSERIAL PRIMARY KEY,
    instrument_id            BIGINT,
    obligation_id            BIGINT,
    classification_version   INT,
    applicability            VARCHAR(50),
    tenant_risk_rating       VARCHAR(50),
    assigned_owner_user_id   INT,
    change_reason            TEXT,
    changed_by_user_id       INT,
    changed_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_classification_history_instrument ON classification_history(instrument_id, changed_at DESC);
CREATE INDEX idx_classification_history_obligation ON classification_history(obligation_id);

CREATE TABLE IF NOT EXISTS obligation_controls (
    obligation_id BIGINT NOT NULL REFERENCES obligations(obligation_id),
    control_id    INT NOT NULL,
    linked_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (obligation_id, control_id)
);
