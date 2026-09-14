CREATE TABLE IF NOT EXISTS obligation_controls (
    obligation_id BIGINT NOT NULL REFERENCES obligation_mappings(obligation_id) ON DELETE CASCADE,
    compliance_control_id BIGINT NOT NULL REFERENCES compliance_controls(compliance_control_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (obligation_id, compliance_control_id)
);
CREATE INDEX idx_obligation_controls_obligation ON obligation_controls(obligation_id);
CREATE INDEX idx_obligation_controls_control ON obligation_controls(compliance_control_id);
