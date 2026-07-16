CREATE TABLE IF NOT EXISTS controls (
    control_id            SERIAL PRIMARY KEY,
    control_number        VARCHAR(100) NOT NULL UNIQUE,
    name                  VARCHAR(500) NOT NULL,
    description           TEXT,
    theme                 VARCHAR(255),
    control_type          VARCHAR(100),
    what_it_does          TEXT,
    how_tested            TEXT,
    control_owner_user_id INT,
    control_owner_name    VARCHAR(255),
    test_frequency        VARCHAR(50),
    test_frequency_days   INT,
    linked_obligation_ids JSONB,
    inherent_risk         VARCHAR(50),
    residual_risk         VARCHAR(50),
    status                VARCHAR(50) DEFAULT 'Active',
    created_by_user_id    INT,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_controls_theme ON controls(theme);
CREATE INDEX idx_controls_owner ON controls(control_owner_user_id);

CREATE TABLE IF NOT EXISTS control_tasks (
    task_id              BIGSERIAL PRIMARY KEY,
    control_id           INT NOT NULL REFERENCES controls(control_id),
    control_number       VARCHAR(100),
    control_name         VARCHAR(500),
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
    remediation_deadline   DATE,
    review_status          VARCHAR(50) DEFAULT 'Pending',
    reviewed_by_user_id    INT,
    reviewed_by_name       VARCHAR(255),
    review_notes           TEXT,
    reviewed_at            TIMESTAMP WITH TIME ZONE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_test_results_control ON control_test_results(control_id, test_date DESC);
