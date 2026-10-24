ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS signed_off_by_user_id INT;
ALTER TABLE return_filing_instances ADD COLUMN IF NOT EXISTS signed_off_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_return_instances_signoff ON return_filing_instances(signed_off_at);
