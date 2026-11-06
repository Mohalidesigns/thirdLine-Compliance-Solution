ALTER TABLE tenant_polling_config
    ADD COLUMN IF NOT EXISTS task_control_horizon_days INT DEFAULT 0;

COMMENT ON COLUMN tenant_polling_config.task_control_horizon_days IS
    'Task Centre control-test look-ahead in days; 0 = use each control''s own test cadence.';