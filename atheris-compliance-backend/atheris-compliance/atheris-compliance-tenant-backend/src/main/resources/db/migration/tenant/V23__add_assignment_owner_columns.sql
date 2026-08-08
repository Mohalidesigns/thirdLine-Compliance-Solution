ALTER TABLE obligation_classifications
    ADD COLUMN IF NOT EXISTS assigned_owner_id      INT REFERENCES owners(owner_id),
    ADD COLUMN IF NOT EXISTS assigned_team_id       INT REFERENCES teams(team_id),
    ADD COLUMN IF NOT EXISTS assigned_department_id INT REFERENCES departments(department_id);

ALTER TABLE controls
    ADD COLUMN IF NOT EXISTS control_owner_id INT REFERENCES owners(owner_id);

ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS assigned_to_owner_id INT REFERENCES owners(owner_id);

CREATE INDEX idx_obligation_class_owner ON obligation_classifications(assigned_owner_id);
CREATE INDEX idx_controls_owner_id      ON controls(control_owner_id);
CREATE INDEX idx_findings_owner         ON findings(assigned_to_owner_id);
