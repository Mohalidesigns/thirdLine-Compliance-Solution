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

INSERT INTO departments (name, code)
SELECT 'Compliance', 'COMP'
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Compliance');
