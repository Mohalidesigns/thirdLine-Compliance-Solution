CREATE TABLE IF NOT EXISTS obligation_notifications (
    notification_id         BIGSERIAL PRIMARY KEY,
    instrument_id           BIGINT NOT NULL,
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
