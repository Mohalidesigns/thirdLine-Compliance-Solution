-- Control Theme vocabulary (tenant-managed). Seeded with the toolkit section themes
-- (the generic "Compliance Risk Management" catch-all is deliberately excluded).
CREATE TABLE IF NOT EXISTS control_themes (
    theme_id     SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL UNIQUE,
    description  TEXT,
    is_active    BOOLEAN DEFAULT true,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO control_themes (name) VALUES
    ('Conduct Risk'),
    ('Corporate Governance'),
    ('Data Protection'),
    ('Capital Market'),
    ('ESG'),
    ('Cybersecurity'),
    ('Consumer Protection'),
    ('Anti-Bribery & Corruption'),
    ('AML/CFT'),
    ('Account Management'),
    ('Cash Management')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS controls (
    control_id                    SERIAL PRIMARY KEY,
    control_number                VARCHAR(100) NOT NULL UNIQUE,
    name                          TEXT NOT NULL,
    description                   TEXT,
    control_theme_id              INT REFERENCES control_themes(theme_id),
    control_type                  VARCHAR(100),
    what_it_does                  TEXT,
    how_tested                    TEXT,
    control_owner_user_id         INT,
    control_owner_name            TEXT,
    control_owner_id              INT REFERENCES owners(owner_id),
    tester_owner_id               INT REFERENCES owners(owner_id),
    tester_user_id                INT,
    tester_name                   VARCHAR(255),
    escalation_policy_id          BIGINT,
    test_frequency                VARCHAR(50),
    test_frequency_days           INT,
    first_due_date                DATE,
    linked_obligation_ids         JSONB,
    inherent_risk                 VARCHAR(50),
    residual_risk                 VARCHAR(50),
    residual_likelihood           VARCHAR(50),
    residual_impact               VARCHAR(50),
    residual_risk_rating          VARCHAR(50),
    owner_name                    TEXT,
    regulatory_requirement        TEXT,
    compliance_area               TEXT,
    monitoring_activity           TEXT,
    due_date                      VARCHAR(100),
    control_effectiveness_measure TEXT,
    act_id                        INT,
    act_name                      TEXT,
    obligation_id                 BIGINT,
    status                        VARCHAR(50) DEFAULT 'Active',
    created_by_user_id            INT,
    created_at                    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_controls_control_theme ON controls(control_theme_id);
CREATE INDEX idx_controls_owner ON controls(control_owner_user_id);
CREATE INDEX idx_controls_owner_id ON controls(control_owner_id);
CREATE INDEX idx_controls_tester_owner ON controls(tester_owner_id);
CREATE INDEX idx_controls_tester_user ON controls(tester_user_id);

CREATE TABLE IF NOT EXISTS control_tasks (
    task_id              BIGSERIAL PRIMARY KEY,
    control_id           INT NOT NULL REFERENCES controls(control_id),
    control_number       VARCHAR(100),
    control_name         TEXT,
    task_type            VARCHAR(100),
    assigned_to_user_id  INT,
    assigned_to_name     VARCHAR(255),
    due_date             DATE,
    status               VARCHAR(50) DEFAULT 'Pending',
    escalation_level     INT DEFAULT 0,
    escalated_at         TIMESTAMP WITH TIME ZONE,
    completed_by_test_id BIGINT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_control_tasks_assignee ON control_tasks(assigned_to_user_id);
CREATE INDEX idx_control_tasks_due ON control_tasks(due_date, status);

CREATE TABLE IF NOT EXISTS control_test_results (
    test_id                BIGSERIAL PRIMARY KEY,
    control_id             INT NOT NULL REFERENCES controls(control_id),
    test_date              DATE,
    tested_by_user_id      INT,
    tested_by_name         VARCHAR(255),
    result                 VARCHAR(50),
    result_description     TEXT,
    failure_details        TEXT,
    failure_severity       VARCHAR(50),
    evidence_url           TEXT,
    remediation_required   BOOLEAN DEFAULT false,
    remediation_owner_user_id INT,
    remediation_owner_id   INT REFERENCES owners(owner_id),
    remediation_deadline   DATE,
    review_status          VARCHAR(50) DEFAULT 'Pending',
    reviewed_by_user_id    INT,
    reviewed_by_name       VARCHAR(255),
    review_notes           TEXT,
    reviewed_at            TIMESTAMP WITH TIME ZONE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_test_results_control ON control_test_results(control_id, test_date DESC);
CREATE INDEX idx_control_test_results_remediation_owner ON control_test_results(remediation_owner_id);
