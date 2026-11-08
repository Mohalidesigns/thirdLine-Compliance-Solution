CREATE TABLE IF NOT EXISTS tenant_regulators (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(50),
    platform_regulator_id INT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tr_tenant ON tenant_regulators(tenant_id);
CREATE INDEX idx_tr_platform ON tenant_regulators(platform_regulator_id);

-- Acts explored by the tenant: one row per platform regulation (act), seeded from the
-- platform regulation seed so the tenant can browse acts and their linked obligations,
-- controls, returns and sanctions.
CREATE TABLE IF NOT EXISTS acts (
    act_id                   SERIAL PRIMARY KEY,
    regulation_id            BIGINT NOT NULL UNIQUE,
    canonical_instrument_id  BIGINT,
    name                     TEXT NOT NULL,
    abbreviation             VARCHAR(50),
    regulator_id             INT,
    regulator_name           TEXT,
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_acts_regulation ON acts(regulation_id);
CREATE INDEX idx_acts_name ON acts(name);

CREATE TABLE IF NOT EXISTS evidence_files (
    file_id              BIGSERIAL PRIMARY KEY,
    file_name            VARCHAR(500) NOT NULL,
    original_name        VARCHAR(500) NOT NULL,
    mime_type            VARCHAR(100),
    file_size            BIGINT,
    storage_path         VARCHAR(1000) NOT NULL,
    source_type          VARCHAR(100),
    source_id            BIGINT,
    description          TEXT,
    uploaded_by_user_id  INT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_evidence_source ON evidence_files(source_type, source_id);
CREATE INDEX idx_evidence_uploaded ON evidence_files(created_at DESC);

CREATE TABLE IF NOT EXISTS regulatory_returns (
    return_id                  BIGSERIAL PRIMARY KEY,
    return_name                TEXT NOT NULL,
    filing_regulator           VARCHAR(100),
    tenant_regulator_id        BIGINT REFERENCES tenant_regulators(id),
    act_id                     BIGINT REFERENCES acts(regulation_id),
    act_name                   TEXT,
    department_id              INT,
    return_type                VARCHAR(100),
    frequency                  VARCHAR(50),
    frequency_type             VARCHAR(20) DEFAULT 'MONTHLY',
    status                     VARCHAR(50) DEFAULT 'Active',
    filing_date                DATE,
    filing_deadline_offset_days INT,
    due_days_after_period_end  INT,
    due_date_source            VARCHAR(20),
    deadline_text              TEXT,
    filing_channel             TEXT,
    return_owner_user_id       INT,
    return_owner_name          TEXT,
    responsible_unit           TEXT,
    responsible_person         TEXT,
    responsible_units          JSONB DEFAULT '[]',
    responsible_persons        JSONB DEFAULT '[]',
    escalation_policy_id       BIGINT,
    event_trigger_label        VARCHAR(255),
    event_deadline_mode        VARCHAR(20),
    event_deadline_days        INT,
    event_deadline_unit        VARCHAR(20),
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT ck_event_trigger_deadline_mode
        CHECK (event_deadline_mode IS NULL OR event_deadline_mode IN ('OFFSET', 'MANUAL')),
    CONSTRAINT ck_event_trigger_deadline_unit
        CHECK (event_deadline_unit IS NULL OR event_deadline_unit IN ('WORKING', 'CALENDAR')),
    CONSTRAINT ck_event_trigger_deadline_days
        CHECK (event_deadline_days IS NULL OR event_deadline_days BETWEEN 1 AND 365)
);

CREATE INDEX idx_returns_regulator ON regulatory_returns(tenant_regulator_id);
CREATE INDEX idx_returns_act ON regulatory_returns(act_id);

CREATE TABLE IF NOT EXISTS return_filing_instances (
    instance_id              BIGSERIAL PRIMARY KEY,
    return_id                BIGINT NOT NULL REFERENCES regulatory_returns(return_id),
    period                   VARCHAR(20),
    due_date                 DATE,
    prep_start_date          DATE,
    current_stage            VARCHAR(50) DEFAULT 'Not Started',
    status                   VARCHAR(50) DEFAULT 'Not Started',
    stage_owner_user_id      INT,
    stage_data               JSONB,
    filing_channel           VARCHAR(255),
    submitted_date           DATE,
    submitted_by_user_id     INT,
    submission_evidence_url  TEXT,
    days_late                INT DEFAULT 0,
    escalation_level         INT DEFAULT 0,
    escalated_at             TIMESTAMP WITH TIME ZONE,
    notes                    TEXT,
    trigger_date             DATE,
    event_reference          TEXT,
    event_evidence_file_id   BIGINT REFERENCES evidence_files(file_id),
    unadjusted_due_date      DATE,
    due_date_adjusted        BOOLEAN NOT NULL DEFAULT FALSE,
    signed_off_by_user_id    INT,
    signed_off_at            TIMESTAMP,
    pending_review           BOOLEAN NOT NULL DEFAULT FALSE,
    review_evidence_ref      TEXT,
    review_submitted_at      TIMESTAMP,
    review_submitted_by_name VARCHAR(255),
    review_submitted_by_email VARCHAR(255),
    review_submitted_by_user_id INT,
    reviewed_at              TIMESTAMP,
    reviewed_by_user_id      INT,
    review_decision          VARCHAR(20),
    review_notes             TEXT,
    completed_at             TIMESTAMP,
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_return_instance_period UNIQUE(return_id, period)
);

CREATE INDEX idx_return_instances_due ON return_filing_instances(due_date);
CREATE INDEX idx_return_instances_return ON return_filing_instances(return_id);
CREATE INDEX idx_return_instances_signoff ON return_filing_instances(signed_off_at);
CREATE INDEX idx_return_instances_pending_review ON return_filing_instances(pending_review);
CREATE INDEX idx_return_instances_trigger_date
    ON return_filing_instances (return_id, trigger_date DESC)
    WHERE trigger_date IS NOT NULL;