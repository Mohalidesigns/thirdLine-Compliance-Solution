CREATE TABLE IF NOT EXISTS obligation_classifications (
    classification_id          BIGSERIAL PRIMARY KEY,
    instrument_id              BIGINT NOT NULL UNIQUE,
    applicability              VARCHAR(50) DEFAULT 'under_review',
    applicability_reasoning    TEXT,
    tenant_risk_rating         VARCHAR(50),
    risk_justification         TEXT,
    assigned_owner_user_id     INT,
    assigned_owner_name        VARCHAR(255),
    assigned_department        VARCHAR(255),
    linked_control_ids         JSONB,
    has_gap                    BOOLEAN DEFAULT false,
    gap_description            TEXT,
    classification_version     INT DEFAULT 1,
    classified_by_user_id      INT,
    classified_at              TIMESTAMP WITH TIME ZONE,
    cco_approved               BOOLEAN DEFAULT false,
    cco_approved_by_user_id    INT,
    cco_approved_at            TIMESTAMP WITH TIME ZONE,
    status                     VARCHAR(50) DEFAULT 'unclassified',
    audit_hash                 VARCHAR(64),
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_obligation_class_status ON obligation_classifications(status);
CREATE INDEX idx_obligation_class_applicability ON obligation_classifications(applicability);

CREATE TABLE IF NOT EXISTS classification_history (
    history_id               BIGSERIAL PRIMARY KEY,
    instrument_id            BIGINT NOT NULL,
    classification_version   INT,
    applicability            VARCHAR(50),
    tenant_risk_rating       VARCHAR(50),
    assigned_owner_user_id   INT,
    has_gap                  BOOLEAN,
    change_reason            TEXT,
    changed_by_user_id       INT,
    changed_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_classification_history_instrument ON classification_history(instrument_id, changed_at DESC);
