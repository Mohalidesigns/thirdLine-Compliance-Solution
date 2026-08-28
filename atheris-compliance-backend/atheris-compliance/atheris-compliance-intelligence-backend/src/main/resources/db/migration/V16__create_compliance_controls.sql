CREATE TABLE IF NOT EXISTS compliance_controls (
    compliance_control_id        BIGSERIAL PRIMARY KEY,
    control_number               VARCHAR(100) NOT NULL UNIQUE,
    theme                        VARCHAR(255),
    regulatory_requirement       TEXT,
    compliance_area              VARCHAR(255),
    risk_level                   VARCHAR(50),
    compliance_control           TEXT,
    monitoring_activity          TEXT,
    frequency                    VARCHAR(50),
    responsible_officer          VARCHAR(255),
    due_date                     VARCHAR(100),
    status                       VARCHAR(50) DEFAULT 'Open',
    control_effectiveness_measure TEXT,
    act_id                       BIGINT REFERENCES acts(act_id),
    act_name                     VARCHAR(500),
    obligation_id                BIGINT REFERENCES obligation_mappings(obligation_id),
    control_type                 VARCHAR(50) DEFAULT 'PRIMARY',
    residual_likelihood          VARCHAR(50),
    residual_impact              VARCHAR(50),
    residual_risk_rating         VARCHAR(50),
    owner_name                   VARCHAR(255),
    linked_obligation_ids        TEXT,
    created_at                   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_compliance_controls_act ON compliance_controls(act_id);
CREATE INDEX idx_compliance_controls_theme ON compliance_controls(theme);
CREATE INDEX idx_compliance_controls_number ON compliance_controls(control_number);
