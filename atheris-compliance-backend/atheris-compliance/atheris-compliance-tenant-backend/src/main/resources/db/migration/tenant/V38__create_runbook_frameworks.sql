-- Compliance Runbooks: framework library (CBN RBCSF, NDPA, ISO 27001, PCI DSS, NIST …) and clauses.
-- Seeded idempotently at startup by RunbookFrameworkSeeder from classpath runbooks/runbook_frameworks.json;
-- tenants may add internal policy frameworks (is_internal = TRUE) through the API.
CREATE TABLE IF NOT EXISTS runbook_frameworks (
    framework_id      SERIAL       PRIMARY KEY,
    code              VARCHAR(50)  NOT NULL UNIQUE,
    name              TEXT         NOT NULL,
    issuer            VARCHAR(100),
    jurisdiction      VARCHAR(10)  NOT NULL DEFAULT 'NG',
    version_label     VARCHAR(50),
    source_url        TEXT,
    is_internal       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runbook_framework_clauses (
    clause_id         BIGSERIAL    PRIMARY KEY,
    framework_id      INT          NOT NULL REFERENCES runbook_frameworks(framework_id),
    clause_ref        VARCHAR(100) NOT NULL,
    title             TEXT         NOT NULL,
    requirement_text  TEXT,
    domain            VARCHAR(100),
    deadline_rule     TEXT,
    sla_minutes       INT,
    UNIQUE (framework_id, clause_ref)
);
CREATE INDEX IF NOT EXISTS idx_rfc_domain ON runbook_framework_clauses(domain);
