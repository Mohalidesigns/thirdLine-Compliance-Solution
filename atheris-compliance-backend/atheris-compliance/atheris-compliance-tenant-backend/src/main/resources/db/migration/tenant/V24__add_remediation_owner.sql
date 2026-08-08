ALTER TABLE control_test_results
    ADD COLUMN remediation_owner_id INT REFERENCES owners(owner_id);

CREATE INDEX idx_control_test_results_remediation_owner
    ON control_test_results (remediation_owner_id);
