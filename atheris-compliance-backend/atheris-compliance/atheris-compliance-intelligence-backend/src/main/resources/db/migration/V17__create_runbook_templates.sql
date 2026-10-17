-- Compliance Runbook template library (platform side).
-- `content` holds one runbook in the portable format ("atheris-runbook/1");
-- tenants pull PUBLISHED templates via /api/v1/internal/runbook-templates.
-- Rows are written only by RunbookTemplateStartupSeeder (classpath runbooks/runbook_templates.json).
CREATE TABLE IF NOT EXISTS runbook_templates (
    template_id       BIGSERIAL PRIMARY KEY,
    template_code     VARCHAR(50)  NOT NULL,
    template_version  INTEGER      NOT NULL DEFAULT 1,
    title             VARCHAR(500) NOT NULL,
    category          VARCHAR(30)  NOT NULL,
    criticality       VARCHAR(20)  NOT NULL,
    frequency         VARCHAR(30),
    sla_minutes       INTEGER,
    objective         TEXT,
    step_count        INTEGER      NOT NULL DEFAULT 0,
    section_count     INTEGER      NOT NULL DEFAULT 0,
    content           JSONB        NOT NULL,
    content_hash      VARCHAR(64)  NOT NULL, -- SHA-256 hex of canonical content (excl. templateVersion)
    status            VARCHAR(20)  NOT NULL DEFAULT 'PUBLISHED',
    published_at      TIMESTAMP WITH TIME ZONE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_runbook_templates_code UNIQUE (template_code)
);

CREATE INDEX IF NOT EXISTS idx_runbook_templates_category    ON runbook_templates(category);
CREATE INDEX IF NOT EXISTS idx_runbook_templates_criticality ON runbook_templates(criticality);
CREATE INDEX IF NOT EXISTS idx_runbook_templates_status      ON runbook_templates(status);
