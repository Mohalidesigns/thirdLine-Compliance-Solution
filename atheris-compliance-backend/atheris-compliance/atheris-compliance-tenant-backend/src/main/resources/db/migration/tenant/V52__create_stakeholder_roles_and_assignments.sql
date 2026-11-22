CREATE TABLE IF NOT EXISTS stakeholder_roles (
    role_id      SERIAL PRIMARY KEY,
    code         VARCHAR(50) NOT NULL UNIQUE,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    is_default   BOOLEAN DEFAULT false,
    is_active    BOOLEAN DEFAULT true,
    sort_order   INT DEFAULT 0,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stakeholder_assignments (
    assignment_id      BIGSERIAL PRIMARY KEY,
    subject_type       VARCHAR(50) NOT NULL,
    subject_id         BIGINT NOT NULL,
    stakeholder_id     INT NOT NULL REFERENCES stakeholders(stakeholder_id),
    role_id            INT NOT NULL REFERENCES stakeholder_roles(role_id),
    created_by_user_id INT,
    is_active          BOOLEAN DEFAULT true,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (subject_type, subject_id, stakeholder_id, role_id)
);

CREATE INDEX idx_stakeholder_assignments_subject ON stakeholder_assignments(subject_type, subject_id);
CREATE INDEX idx_stakeholder_assignments_stakeholder ON stakeholder_assignments(stakeholder_id);

CREATE TABLE IF NOT EXISTS return_responsible_stakeholders (
    id             BIGSERIAL PRIMARY KEY,
    return_id      BIGINT NOT NULL REFERENCES regulatory_returns(return_id),
    stakeholder_id INT NOT NULL REFERENCES stakeholders(stakeholder_id),
    role_id        INT REFERENCES stakeholder_roles(role_id),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (return_id, stakeholder_id)
);

CREATE INDEX idx_return_responsible_return ON return_responsible_stakeholders(return_id);
CREATE INDEX idx_return_responsible_stakeholder ON return_responsible_stakeholders(stakeholder_id);
