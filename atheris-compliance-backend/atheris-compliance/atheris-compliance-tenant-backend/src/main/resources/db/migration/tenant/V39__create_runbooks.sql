-- Compliance Runbooks: runbooks, immutable versions and the version content tree
-- (sections → steps → evidence requirements; prerequisites, escalation ladder, rollback steps, approvals).
CREATE TABLE IF NOT EXISTS runbooks (
    runbook_id            BIGSERIAL    PRIMARY KEY,
    runbook_code          VARCHAR(50)  NOT NULL UNIQUE,
    title                 TEXT         NOT NULL,
    category              VARCHAR(50)  NOT NULL,
    objective             TEXT,
    scope_systems         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    scope_teams           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    owner_user_id         INT,
    owner_name            TEXT,
    criticality           VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    frequency             VARCHAR(30),
    sla_minutes           INT,
    review_cadence        VARCHAR(20)  NOT NULL DEFAULT 'ANNUAL',
    status                VARCHAR(30)  NOT NULL DEFAULT 'DRAFT',
    status_reason         TEXT,
    current_version_id    BIGINT,
    source_template_id    BIGINT,
    source_template_code  VARCHAR(50),
    source_template_ver   INT,
    linked_obligation_ids JSONB        NOT NULL DEFAULT '[]'::jsonb,
    linked_control_ids    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    tags                  JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_by_user_id    INT,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runbooks_category_status ON runbooks(category, status);
CREATE INDEX IF NOT EXISTS idx_runbooks_owner ON runbooks(owner_user_id);

CREATE TABLE IF NOT EXISTS runbook_versions (
    version_id          BIGSERIAL    PRIMARY KEY,
    runbook_id          BIGINT       NOT NULL REFERENCES runbooks(runbook_id),
    version_number      INT          NOT NULL,
    change_summary      TEXT,
    content_hash        VARCHAR(64),
    status              VARCHAR(30)  NOT NULL DEFAULT 'DRAFT',   -- DRAFT|IN_REVIEW|PUBLISHED|SUPERSEDED
    authored_by_user_id INT,
    submitted_at        TIMESTAMP WITH TIME ZONE,
    approved_by_user_id INT,
    approved_at         TIMESTAMP WITH TIME ZONE,
    published_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (runbook_id, version_number)
);

CREATE TABLE IF NOT EXISTS runbook_sections (
    section_id    BIGSERIAL    PRIMARY KEY,
    version_id    BIGINT       NOT NULL REFERENCES runbook_versions(version_id) ON DELETE CASCADE,
    sort_order    INT          NOT NULL,
    section_type  VARCHAR(30)  NOT NULL,
    title         TEXT         NOT NULL,
    description   TEXT
);
CREATE INDEX IF NOT EXISTS idx_runbook_sections_version ON runbook_sections(version_id, sort_order);

CREATE TABLE IF NOT EXISTS runbook_steps (
    step_id               BIGSERIAL    PRIMARY KEY,
    section_id            BIGINT       NOT NULL REFERENCES runbook_sections(section_id) ON DELETE CASCADE,
    sort_order            INT          NOT NULL,
    step_code             VARCHAR(20),
    title                 TEXT         NOT NULL,
    instruction_md        TEXT         NOT NULL,
    command_block         TEXT,
    command_lang          VARCHAR(30),
    expected_result       TEXT,
    duration_estimate_min INT,
    assigned_role         VARCHAR(30),
    is_blocking           BOOLEAN      NOT NULL DEFAULT TRUE,
    requires_dual_control BOOLEAN      NOT NULL DEFAULT FALSE,
    allow_skip            BOOLEAN      NOT NULL DEFAULT FALSE,
    safety_note           TEXT
);
CREATE INDEX IF NOT EXISTS idx_runbook_steps_section ON runbook_steps(section_id, sort_order);

CREATE TABLE IF NOT EXISTS runbook_step_evidence_reqs (
    req_id          BIGSERIAL    PRIMARY KEY,
    step_id         BIGINT       NOT NULL REFERENCES runbook_steps(step_id) ON DELETE CASCADE,
    evidence_type   VARCHAR(30)  NOT NULL,
    label           TEXT         NOT NULL,
    is_mandatory    BOOLEAN      NOT NULL DEFAULT TRUE,
    retention_years INT          DEFAULT 7,
    accepted_mime   JSONB        DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_runbook_evreq_step ON runbook_step_evidence_reqs(step_id);

CREATE TABLE IF NOT EXISTS runbook_prerequisites (
    prereq_id     BIGSERIAL    PRIMARY KEY,
    version_id    BIGINT       NOT NULL REFERENCES runbook_versions(version_id) ON DELETE CASCADE,
    sort_order    INT          NOT NULL DEFAULT 0,
    prereq_type   VARCHAR(20)  NOT NULL,
    label         TEXT         NOT NULL,
    detail        TEXT,
    is_mandatory  BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS runbook_escalation_paths (
    escalation_id   BIGSERIAL    PRIMARY KEY,
    version_id      BIGINT       NOT NULL REFERENCES runbook_versions(version_id) ON DELETE CASCADE,
    level           INT          NOT NULL,
    trigger_type    VARCHAR(30)  NOT NULL,
    notify_role     VARCHAR(30),
    notify_user_id  INT,
    notify_channel  VARCHAR(20)  DEFAULT 'IN_APP',
    wait_minutes    INT          DEFAULT 0,
    instructions    TEXT
);

-- Rollback steps reference the step they reverse by id; the step code is kept too so a draft
-- tree can be re-saved (step ids change on every save) without losing the link.
CREATE TABLE IF NOT EXISTS runbook_rollback_steps (
    rollback_id        BIGSERIAL    PRIMARY KEY,
    version_id         BIGINT       NOT NULL REFERENCES runbook_versions(version_id) ON DELETE CASCADE,
    sort_order         INT          NOT NULL,
    reverses_step_id   BIGINT       REFERENCES runbook_steps(step_id) ON DELETE SET NULL,
    reverses_step_code VARCHAR(20),
    title              TEXT         NOT NULL,
    instruction_md     TEXT         NOT NULL,
    command_block      TEXT,
    verification       TEXT
);

CREATE TABLE IF NOT EXISTS runbook_clause_map (
    runbook_id  BIGINT NOT NULL REFERENCES runbooks(runbook_id) ON DELETE CASCADE,
    clause_id   BIGINT NOT NULL REFERENCES runbook_framework_clauses(clause_id),
    PRIMARY KEY (runbook_id, clause_id)
);

CREATE TABLE IF NOT EXISTS runbook_step_clause_map (
    step_id   BIGINT NOT NULL REFERENCES runbook_steps(step_id) ON DELETE CASCADE,
    clause_id BIGINT NOT NULL REFERENCES runbook_framework_clauses(clause_id),
    PRIMARY KEY (step_id, clause_id)
);

CREATE TABLE IF NOT EXISTS runbook_version_approvals (
    approval_id      BIGSERIAL    PRIMARY KEY,
    version_id       BIGINT       NOT NULL REFERENCES runbook_versions(version_id) ON DELETE CASCADE,
    approver_user_id INT          NOT NULL,
    approver_role    VARCHAR(30),
    decision         VARCHAR(20)  NOT NULL,   -- APPROVED|REJECTED|CHANGES_REQUESTED
    comment          TEXT,
    decided_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
