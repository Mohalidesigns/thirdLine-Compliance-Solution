CREATE TABLE IF NOT EXISTS findings (
    finding_id                BIGSERIAL PRIMARY KEY,
    triggered_by_test_id      BIGINT,
    trigger_reason            VARCHAR(255),
    finding_type              VARCHAR(100),
    severity                  VARCHAR(50),
    description               TEXT,
    assigned_to_user_id       INT,
    assigned_to_name          VARCHAR(255),
    assigned_at               TIMESTAMP WITH TIME ZONE,
    status                    VARCHAR(50) DEFAULT 'Open',
    remediation_deadline      DATE,
    sla_days                  INT,
    remediation_notes         TEXT,
    remediation_evidence_url  TEXT,
    remediation_submitted_at  TIMESTAMP WITH TIME ZONE,
    -- Who submitted the remediation (the signer must be a different person), and
    -- the reviewer's note when a remediation is rejected.
    remediation_submitted_by_user_id INT,
    remediation_submitted_via_link BOOLEAN NOT NULL DEFAULT FALSE,
    review_notes              TEXT,
    -- Generic sign-off (Analyst, CCO or Tenant Admin may sign off) — not CCO-specific.
    signed_off_by_user_id     INT,
    signed_off_at             TIMESTAMP WITH TIME ZONE,
    closed_at                 TIMESTAMP WITH TIME ZONE,
    created_by_user_id        INT,
    linked_obligation_id      BIGINT,
    linked_control_id         INT,
    external_reference        VARCHAR(100),
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_deadline ON findings(remediation_deadline, status);

-- Optional external id (e.g. an audit report reference) used to dedup bulk imports.
CREATE UNIQUE INDEX idx_findings_external_reference ON findings (LOWER(external_reference)) WHERE external_reference IS NOT NULL;
