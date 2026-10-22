CREATE TABLE IF NOT EXISTS escalation_policies (
    policy_id              BIGSERIAL PRIMARY KEY,
    name                   VARCHAR(255) NOT NULL,
    subject_type           VARCHAR(20) NOT NULL,
    is_default             BOOLEAN NOT NULL DEFAULT FALSE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_start_value   INT,
    reminder_start_unit    VARCHAR(10),
    reminder_repeat_value  INT,
    reminder_repeat_unit   VARCHAR(10),
    send_link              BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_start        BOOLEAN NOT NULL DEFAULT FALSE,
    frequency_scope        VARCHAR(20),
    created_by_user_id     INT,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_escalation_policy_name
    ON escalation_policies (subject_type, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_escalation_policy_default
    ON escalation_policies (subject_type, COALESCE(frequency_scope, '')) WHERE is_default;

CREATE TABLE IF NOT EXISTS escalation_policy_levels (
    level_id        BIGSERIAL PRIMARY KEY,
    policy_id       BIGINT NOT NULL REFERENCES escalation_policies(policy_id) ON DELETE CASCADE,
    level_no        INT NOT NULL,
    after_value     INT NOT NULL DEFAULT 0,
    after_unit      VARCHAR(10) NOT NULL DEFAULT 'DAYS',
    target_type     VARCHAR(25) NOT NULL,
    target_role     VARCHAR(30),
    target_user_id  INT,
    target_name     VARCHAR(255),
    target_email    VARCHAR(255),
    CONSTRAINT uq_escalation_policy_level UNIQUE (policy_id, level_no)
);

CREATE TABLE IF NOT EXISTS escalation_instances (
    override_id            BIGSERIAL PRIMARY KEY,
    subject_type           VARCHAR(20) NOT NULL,
    subject_id             BIGINT NOT NULL,
    source_policy_id       BIGINT REFERENCES escalation_policies(policy_id) ON DELETE SET NULL,
    reminder_start_value   INT,
    reminder_start_unit    VARCHAR(10),
    reminder_repeat_value  INT,
    reminder_repeat_unit   VARCHAR(10),
    send_link              BOOLEAN NOT NULL DEFAULT TRUE,
    active                 BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_escalation_instance UNIQUE (subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS escalation_instance_levels (
    level_id        BIGSERIAL PRIMARY KEY,
    override_id     BIGINT NOT NULL REFERENCES escalation_instances(override_id) ON DELETE CASCADE,
    level_no        INT NOT NULL,
    after_value     INT NOT NULL DEFAULT 0,
    after_unit      VARCHAR(10) NOT NULL DEFAULT 'DAYS',
    target_type     VARCHAR(25) NOT NULL,
    target_role     VARCHAR(30),
    target_user_id  INT,
    target_name     VARCHAR(255),
    target_email    VARCHAR(255),
    CONSTRAINT uq_escalation_instance_level UNIQUE (override_id, level_no)
);

CREATE TABLE IF NOT EXISTS escalation_events (
    event_id        BIGSERIAL PRIMARY KEY,
    subject_type    VARCHAR(20) NOT NULL,
    subject_id      BIGINT NOT NULL,
    subject_label   VARCHAR(500),
    trigger_type    VARCHAR(20) NOT NULL,
    level           INT NOT NULL DEFAULT 0,
    target_type     VARCHAR(25),
    target_user_id  INT,
    target_role     VARCHAR(30),
    target_name     VARCHAR(255),
    target_email    VARCHAR(255),
    cc              TEXT,
    channel         VARCHAR(20),
    template_key    VARCHAR(100),
    fired_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_escalation_event UNIQUE (subject_type, subject_id, trigger_type, level)
);

CREATE INDEX IF NOT EXISTS idx_escalation_events_subject ON escalation_events (subject_type, subject_id);

ALTER TABLE regulatory_returns ADD COLUMN IF NOT EXISTS escalation_policy_id BIGINT;
ALTER TABLE controls ADD COLUMN IF NOT EXISTS escalation_policy_id BIGINT;
