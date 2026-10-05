ALTER TABLE regulatory_returns
    ADD COLUMN event_trigger_label VARCHAR(255),
    ADD COLUMN event_deadline_mode VARCHAR(20),
    ADD COLUMN event_deadline_days INT,
    ADD COLUMN event_deadline_unit VARCHAR(20);

ALTER TABLE regulatory_returns
    ADD CONSTRAINT ck_event_trigger_deadline_mode
        CHECK (event_deadline_mode IS NULL OR event_deadline_mode IN ('OFFSET', 'MANUAL')),
    ADD CONSTRAINT ck_event_trigger_deadline_unit
        CHECK (event_deadline_unit IS NULL OR event_deadline_unit IN ('WORKING', 'CALENDAR')),
    ADD CONSTRAINT ck_event_trigger_deadline_days
        CHECK (event_deadline_days IS NULL OR event_deadline_days BETWEEN 1 AND 365);

ALTER TABLE return_filing_instances
    ADD COLUMN trigger_date DATE,
    ADD COLUMN event_reference TEXT,
    ADD COLUMN event_evidence_file_id BIGINT,
    ADD COLUMN unadjusted_due_date DATE,
    ADD COLUMN due_date_adjusted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE return_filing_instances
    ADD CONSTRAINT fk_return_event_evidence
    FOREIGN KEY (event_evidence_file_id) REFERENCES evidence_files(file_id);

CREATE INDEX idx_return_instances_trigger_date
    ON return_filing_instances (return_id, trigger_date DESC)
    WHERE trigger_date IS NOT NULL;
