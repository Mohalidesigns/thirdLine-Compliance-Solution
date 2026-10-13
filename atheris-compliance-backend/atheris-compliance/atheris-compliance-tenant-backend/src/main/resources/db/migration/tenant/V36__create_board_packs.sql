-- Board packs: generated, GCO-signable compliance reports for the board.
-- A pack is created DRAFT (watermarked PDF) and frozen once the CCO signs it off.
CREATE TABLE IF NOT EXISTS board_packs (
    board_pack_id        BIGSERIAL    PRIMARY KEY,
    tenant_id            BIGINT,
    period_from          DATE         NOT NULL,
    period_to            DATE         NOT NULL,
    sections             JSONB        NOT NULL DEFAULT '[]'::jsonb,
    status               VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',   -- DRAFT | SIGNED_OFF
    compliance_score     DOUBLE PRECISION,
    file_path            TEXT,
    file_name            VARCHAR(255),
    file_sha256          VARCHAR(64),
    generated_by_user_id INT,
    generated_by_name    VARCHAR(255),
    generated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    signed_off_by_user_id INT,
    signed_off_by_name   VARCHAR(255),
    signed_off_at        TIMESTAMP WITH TIME ZONE,
    sign_off_note        TEXT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_board_packs_generated ON board_packs(generated_at DESC);
CREATE INDEX idx_board_packs_status    ON board_packs(status);

-- Per-tenant weights for the compliance score. Percentages that must sum to 100;
-- a missing row means the defaults are used.
CREATE TABLE IF NOT EXISTS compliance_score_weights (
    weight_id           BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL,
    control_coverage    INT NOT NULL DEFAULT 30,
    control_tests       INT NOT NULL DEFAULT 25,
    returns_on_time     INT NOT NULL DEFAULT 30,
    findings_within_sla INT NOT NULL DEFAULT 15,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_score_weights_tenant UNIQUE (tenant_id)
);