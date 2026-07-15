CREATE TABLE IF NOT EXISTS findings (
    finding_id                BIGSERIAL PRIMARY KEY,
    triggered_by_test_id      BIGINT,
    trigger_reason            VARCHAR(255),
    finding_type              VARCHAR(100),
    severity                  VARCHAR(50),
    description               TEXT,
    root_cause                TEXT,
    assigned_to_user_id       INT,
    assigned_to_name          VARCHAR(255),
    assigned_at               TIMESTAMP WITH TIME ZONE,
    status                    VARCHAR(50) DEFAULT 'Open',
    remediation_deadline      DATE,
    sla_days                  INT,
    remediation_notes         TEXT,
    remediation_evidence_url  TEXT,
    remediation_submitted_at  TIMESTAMP WITH TIME ZONE,
    cco_sign_off_user_id      INT,
    cco_sign_off_at           TIMESTAMP WITH TIME ZONE,
    closed_at                 TIMESTAMP WITH TIME ZONE,
    created_by_user_id        INT,
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_deadline ON findings(remediation_deadline, status);
