-- Account-less links that let a control's tester record a test result (Passed/Failed/Partial + notes +
-- evidence) for a scheduled test task. Deterministic per control, so the same URL is reproducible and
-- only a SHA-256 hash of the token is ever stored.
CREATE TABLE IF NOT EXISTS control_test_links (
    link_id            BIGSERIAL    PRIMARY KEY,
    token_hash         VARCHAR(64)  NOT NULL UNIQUE,
    control_id         INT          NOT NULL REFERENCES controls(control_id),
    task_id            BIGINT,
    recipient_email    VARCHAR(255),
    recipient_name     VARCHAR(255),
    expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at         TIMESTAMP WITH TIME ZONE,
    last_used_at       TIMESTAMP WITH TIME ZONE,
    use_count          INT          NOT NULL DEFAULT 0,
    created_by_user_id INT,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_control_test_links_control ON control_test_links(control_id);
CREATE INDEX IF NOT EXISTS idx_control_test_links_task ON control_test_links(task_id);
CREATE INDEX IF NOT EXISTS idx_control_test_links_hash ON control_test_links(token_hash);
