ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS pending_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS review_evidence_ref TEXT;
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS review_submitted_at TIMESTAMP;
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS review_submitted_by_name VARCHAR(255);
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS review_submitted_by_email VARCHAR(255);
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS review_submitted_by_user_id INT;
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS reviewed_by_user_id INT;
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS review_decision VARCHAR(20);
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_return_instances_pending_review ON return_filing_instances(pending_review);
