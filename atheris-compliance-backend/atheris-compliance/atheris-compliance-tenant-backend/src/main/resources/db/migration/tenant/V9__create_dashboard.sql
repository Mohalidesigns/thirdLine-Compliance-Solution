CREATE TABLE IF NOT EXISTS dashboard_snapshots (
    snapshot_id                   BIGSERIAL PRIMARY KEY,
    snapshot_date                 DATE NOT NULL,
    computed_at                   TIMESTAMP WITH TIME ZONE,
    total_obligations_active      INT DEFAULT 0,
    total_obligations_inapplicable INT DEFAULT 0,
    obligations_high_risk         INT DEFAULT 0,
    obligations_with_gaps         INT DEFAULT 0,
    controls_total                INT DEFAULT 0,
    controls_passing              INT DEFAULT 0,
    controls_failing              INT DEFAULT 0,
    controls_test_completion_rate DOUBLE PRECISION DEFAULT 0.0,
    findings_open                 INT DEFAULT 0,
    findings_high_severity        INT DEFAULT 0,
    findings_overdue_remediation  INT DEFAULT 0,
    returns_total                 INT DEFAULT 0,
    returns_submitted_on_time     INT DEFAULT 0,
    returns_submitted_late        INT DEFAULT 0,
    returns_pending               INT DEFAULT 0,
    total_penalty_exposure_naira  DECIMAL(20,2) DEFAULT 0.00,
    compliance_score              DOUBLE PRECISION DEFAULT 0.0
);

CREATE INDEX idx_dashboard_date ON dashboard_snapshots(snapshot_date DESC);
