-- Compliance Runbooks: executions of a published version, per-step results, immutable evidence,
-- escalations and sign-offs.
CREATE SEQUENCE IF NOT EXISTS runbook_execution_ref_seq START 1;

CREATE TABLE IF NOT EXISTS runbook_executions (
    execution_id           BIGSERIAL    PRIMARY KEY,
    execution_ref          VARCHAR(40)  NOT NULL UNIQUE,             -- RBX-2026-000123
    runbook_id             BIGINT       NOT NULL REFERENCES runbooks(runbook_id),
    version_id             BIGINT       NOT NULL REFERENCES runbook_versions(version_id),
    trigger_type           VARCHAR(20)  NOT NULL,                    -- SCHEDULED|MANUAL|INCIDENT|FINDING|REVIEW
    trigger_ref_id         BIGINT,
    schedule_id            BIGINT,
    scheduled_for          DATE,
    operator_user_id       INT          NOT NULL,
    operator_name          TEXT,
    status                 VARCHAR(30)  NOT NULL DEFAULT 'NOT_STARTED',
    outcome                VARCHAR(20),                              -- PASS|FAIL once every step is terminal
    status_before_pause    VARCHAR(30),
    started_at             TIMESTAMP WITH TIME ZONE,
    due_at                 TIMESTAMP WITH TIME ZONE,
    preflight_completed_at TIMESTAMP WITH TIME ZONE,
    preflight_acks         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    completed_at           TIMESTAMP WITH TIME ZONE,
    closed_at              TIMESTAMP WITH TIME ZONE,
    outcome_summary        TEXT,
    steps_total            INT          DEFAULT 0,
    steps_passed           INT          DEFAULT 0,
    steps_failed           INT          DEFAULT 0,
    steps_skipped          INT          DEFAULT 0,
    evidence_count         INT          DEFAULT 0,
    finding_id             BIGINT,
    pack_file_id           BIGINT,
    pack_hash              VARCHAR(64),
    pack_generated_at      TIMESTAMP WITH TIME ZONE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rbx_runbook ON runbook_executions(runbook_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_rbx_status_due ON runbook_executions(status, due_at);
-- A schedule creates at most one execution per due date (idempotent scheduler).
CREATE UNIQUE INDEX IF NOT EXISTS uq_rbx_schedule_date ON runbook_executions(schedule_id, scheduled_for)
    WHERE schedule_id IS NOT NULL;

-- One row per step of the executed version; rollback steps are added as rows with rollback_id set.
CREATE TABLE IF NOT EXISTS runbook_step_executions (
    step_exec_id         BIGSERIAL    PRIMARY KEY,
    execution_id         BIGINT       NOT NULL REFERENCES runbook_executions(execution_id) ON DELETE CASCADE,
    step_id              BIGINT       REFERENCES runbook_steps(step_id),
    rollback_id          BIGINT       REFERENCES runbook_rollback_steps(rollback_id),
    sort_order           INT          NOT NULL,
    status               VARCHAR(30)  NOT NULL DEFAULT 'PENDING',    -- PENDING|IN_PROGRESS|AWAITING_VERIFICATION|PASSED|FAILED|SKIPPED|NA
    actual_result        TEXT,
    operator_notes       TEXT,
    failure_category     VARCHAR(30),
    performed_by_user_id INT,
    verified_by_user_id  INT,
    started_at           TIMESTAMP WITH TIME ZONE,
    completed_at         TIMESTAMP WITH TIME ZONE,
    skip_reason          TEXT,
    UNIQUE (execution_id, step_id),
    UNIQUE (execution_id, rollback_id)
);

-- Evidence is immutable: the API exposes no update or delete for these rows.
CREATE TABLE IF NOT EXISTS runbook_evidence_items (
    evidence_id         BIGSERIAL    PRIMARY KEY,
    step_exec_id        BIGINT       NOT NULL REFERENCES runbook_step_executions(step_exec_id) ON DELETE CASCADE,
    req_id              BIGINT       REFERENCES runbook_step_evidence_reqs(req_id),
    evidence_type       VARCHAR(30)  NOT NULL,
    file_id             BIGINT,
    external_ref        TEXT,
    attestation_text    TEXT,
    sha256              VARCHAR(64),
    retention_years     INT,
    captured_by_user_id INT          NOT NULL,
    captured_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_immutable        BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_rb_evidence_step ON runbook_evidence_items(step_exec_id);

CREATE TABLE IF NOT EXISTS runbook_execution_escalations (
    exec_esc_id             BIGSERIAL    PRIMARY KEY,
    execution_id            BIGINT       NOT NULL REFERENCES runbook_executions(execution_id) ON DELETE CASCADE,
    level                   INT          NOT NULL,
    trigger_type            VARCHAR(30)  NOT NULL,
    notified_user_id        INT,
    notified_role           VARCHAR(30),
    channel                 VARCHAR(20),
    sent_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at         TIMESTAMP WITH TIME ZONE,
    acknowledged_by_user_id INT,
    notes                   TEXT
);
CREATE INDEX IF NOT EXISTS idx_rb_exec_esc ON runbook_execution_escalations(execution_id, trigger_type);

CREATE TABLE IF NOT EXISTS runbook_execution_signoffs (
    signoff_id    BIGSERIAL    PRIMARY KEY,
    execution_id  BIGINT       NOT NULL REFERENCES runbook_executions(execution_id) ON DELETE CASCADE,
    signoff_role  VARCHAR(30)  NOT NULL,    -- OPERATOR|REVIEWER|CCO|AUDITOR
    user_id       INT          NOT NULL,
    decision      VARCHAR(20)  NOT NULL,    -- ACCEPTED|REJECTED
    comment       TEXT,
    signed_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
