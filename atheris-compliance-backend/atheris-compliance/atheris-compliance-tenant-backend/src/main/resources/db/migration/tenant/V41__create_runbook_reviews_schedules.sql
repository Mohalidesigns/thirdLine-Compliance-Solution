-- Compliance Runbooks: execution schedules (frequency-driven, holiday-aware) and periodic reviews.
CREATE TABLE IF NOT EXISTS runbook_schedules (
    schedule_id      BIGSERIAL    PRIMARY KEY,
    runbook_id       BIGINT       NOT NULL REFERENCES runbooks(runbook_id) ON DELETE CASCADE,
    frequency        VARCHAR(30)  NOT NULL,
    cron_expr        VARCHAR(100),
    timezone         VARCHAR(50)  DEFAULT 'Africa/Lagos',
    lead_days        INT          DEFAULT 5,
    assignee_user_id INT,
    assignee_role    VARCHAR(30),
    anchor_date      DATE,
    next_run_at      DATE,
    last_run_at      DATE,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    skip_holidays    BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_rb_sched_next ON runbook_schedules(is_active, next_run_at);

CREATE TABLE IF NOT EXISTS runbook_review_schedules (
    review_sched_id  BIGSERIAL    PRIMARY KEY,
    runbook_id       BIGINT       NOT NULL UNIQUE REFERENCES runbooks(runbook_id) ON DELETE CASCADE,
    cadence          VARCHAR(20)  NOT NULL DEFAULT 'ANNUAL',
    next_review_at   DATE         NOT NULL,
    reviewer_user_id INT,
    reviewer_role    VARCHAR(30)  DEFAULT 'CCO'
);

CREATE TABLE IF NOT EXISTS runbook_review_events (
    review_id            BIGSERIAL    PRIMARY KEY,
    runbook_id           BIGINT       NOT NULL REFERENCES runbooks(runbook_id) ON DELETE CASCADE,
    trigger_type         VARCHAR(30)  NOT NULL,
    trigger_ref          TEXT,
    status               VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    opened_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewer_user_id     INT,
    outcome_notes        TEXT,
    resulting_version_id BIGINT,
    closed_at            TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_rb_review_open ON runbook_review_events(status, opened_at);
