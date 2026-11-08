-- Optional explicit first test due date for a control. When set, the first control test task is
-- anchored to this date (so it can read as overdue); otherwise it is computed from the test
-- frequency, and later tests always follow the frequency from the last recorded test.
ALTER TABLE controls ADD COLUMN IF NOT EXISTS first_due_date DATE;
