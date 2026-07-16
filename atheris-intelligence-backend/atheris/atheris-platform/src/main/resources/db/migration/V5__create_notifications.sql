CREATE TABLE IF NOT EXISTS obligation_changes (
    change_id                       BIGSERIAL    PRIMARY KEY,
    instrument_id                   BIGINT       NOT NULL REFERENCES instruments(instrument_id),
    change_type                     VARCHAR(50)  NOT NULL,
    changed_fields                  JSONB        NOT NULL,
    change_summary                  TEXT         NOT NULL,
    change_severity                 VARCHAR(20)  DEFAULT 'medium',
    changed_by                      VARCHAR(50),
    superseded_by_instrument_id     BIGINT       REFERENCES instruments(instrument_id),
    created_at                      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_changes_instrument ON obligation_changes(instrument_id, created_at DESC);

CREATE TABLE IF NOT EXISTS obligation_watches (
    watch_id               BIGSERIAL   PRIMARY KEY,
    instrument_id          BIGINT      NOT NULL REFERENCES instruments(instrument_id),
    tenant_id              BIGINT NOT NULL REFERENCES tenants(tenant_id),
    classification         VARCHAR(50),
    classified_at          TIMESTAMP WITH TIME ZONE,
    classified_by_user_id  INT,
    is_watching            BOOLEAN     DEFAULT true,
    notify_email           BOOLEAN     DEFAULT true,
    notify_in_app          BOOLEAN     DEFAULT true,
    notify_webhook         BOOLEAN     DEFAULT true,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (instrument_id, tenant_id)
);

CREATE INDEX idx_watches_instrument ON obligation_watches(instrument_id) WHERE is_watching = true;
CREATE INDEX idx_watches_tenant     ON obligation_watches(tenant_id)     WHERE is_watching = true;
