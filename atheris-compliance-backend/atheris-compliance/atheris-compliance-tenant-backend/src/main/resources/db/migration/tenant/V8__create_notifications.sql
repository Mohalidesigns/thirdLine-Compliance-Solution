CREATE TABLE IF NOT EXISTS obligation_notifications (
    notification_id         BIGSERIAL PRIMARY KEY,
    instrument_id           BIGINT,
    recipient_user_id       INT,
    recipient_role          VARCHAR(50),
    category                VARCHAR(50),
    link                    TEXT,
    change_type             VARCHAR(100),
    change_severity         VARCHAR(50),
    change_summary          TEXT,
    changed_fields          TEXT,
    status                  VARCHAR(50) DEFAULT 'unread',
    acknowledged_by_user_id INT,
    read_at                 TIMESTAMP WITH TIME ZONE,
    acknowledged_at         TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_status ON obligation_notifications(status, created_at DESC);
CREATE INDEX idx_notifications_instrument ON obligation_notifications(instrument_id);
-- Delivers to a specific user or to everyone holding a role (recipient_user_id null + recipient_role set).
CREATE INDEX idx_notifications_recipient ON obligation_notifications(recipient_user_id, status);
CREATE INDEX idx_notifications_role ON obligation_notifications(recipient_role, status);