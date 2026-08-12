CREATE TABLE IF NOT EXISTS regulatory_returns (
    return_id                  BIGSERIAL PRIMARY KEY,
    return_name                VARCHAR(500) NOT NULL,
    filing_regulator           VARCHAR(100),
    tenant_regulator_id        BIGINT,
    return_type                VARCHAR(100),
    frequency                  VARCHAR(50),
    status                     VARCHAR(50) DEFAULT 'Active',
    filing_due_day_of_month    INT,
    filing_deadline_offset_days INT,
    filing_channel             VARCHAR(255),
    return_owner_user_id       INT,
    return_owner_name          VARCHAR(255),
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_return_instance_period UNIQUE(return_id, period)
);

CREATE INDEX idx_return_instances_due ON return_filing_instances(due_date);
CREATE INDEX idx_return_instances_return ON return_filing_instances(return_id);
