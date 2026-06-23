CREATE TABLE IF NOT EXISTS obligation_mappings (
    obligation_id           BIGSERIAL PRIMARY KEY,
    instrument_id           BIGINT NOT NULL REFERENCES instruments(instrument_id),
    obligation_number       INT,
    plain_english_statement TEXT NOT NULL,
    specific_section_reference VARCHAR(100),
    obligation_type         VARCHAR(100),
    recurring_deadline_type VARCHAR(50),
    compliance_deadline_days INT,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_obligation_mappings_instrument ON obligation_mappings(instrument_id);

CREATE TABLE IF NOT EXISTS sanctions_and_penalties (
    sanction_id               BIGSERIAL PRIMARY KEY,
    instrument_id             BIGINT NOT NULL REFERENCES instruments(instrument_id),
    sanction_type             VARCHAR(100),
    sanction_amount_naira     DECIMAL(15,2),
    sanction_amount_per_day   BOOLEAN,
    liable_roles              JSONB,
    personal_liability_naira  DECIMAL(15,2),
    severity_score            INT,
    has_been_enforced         BOOLEAN DEFAULT false,
    recent_enforcement_date   DATE,
    recent_enforcement_amount DECIMAL(15,2),
    description               TEXT,
    source_section_reference  TEXT,
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_queue (
    job_id           BIGSERIAL PRIMARY KEY,
    job_type         VARCHAR(100) NOT NULL,
    subject_type     VARCHAR(50),
    subject_id       BIGINT,
    payload          JSONB NOT NULL DEFAULT '{}',
    status           VARCHAR(50) DEFAULT 'pending',
    priority         INT DEFAULT 0,
    attempt_count    INT DEFAULT 0,
    max_attempts     INT DEFAULT 3,
    last_error       TEXT,
    next_retry_at    TIMESTAMP WITH TIME ZONE,
    started_at       TIMESTAMP WITH TIME ZONE,
    completed_at     TIMESTAMP WITH TIME ZONE,
    created_by_service VARCHAR(100),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_queue_type_status_priority ON job_queue(job_type, status, priority DESC, created_at);
CREATE INDEX idx_job_queue_retry ON job_queue(status, next_retry_at) WHERE status = 'failed';

CREATE TABLE IF NOT EXISTS scraper_run_logs (
    log_id            BIGSERIAL PRIMARY KEY,
    regulator_id      INT NOT NULL REFERENCES regulators(regulator_id),
    mode              VARCHAR(50) DEFAULT 'monitoring',
    run_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    documents_found   INT DEFAULT 0,
    new_documents     INT DEFAULT 0,
    skipped_documents INT DEFAULT 0,
    failed_documents  INT DEFAULT 0,
    status            VARCHAR(50),
    error_message     TEXT,
    duration_ms       INT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scraper_run_logs_regulator ON scraper_run_logs(regulator_id, run_at DESC);
