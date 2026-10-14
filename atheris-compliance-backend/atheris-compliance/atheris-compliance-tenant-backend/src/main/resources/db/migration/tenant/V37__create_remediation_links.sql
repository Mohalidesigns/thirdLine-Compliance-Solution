-- Secure links that let a finding's owner submit remediation evidence without an account.
-- Only a SHA-256 hash of the token is stored. A link is reusable until the finding is
-- approved or the link is revoked, and it expires at the finding deadline + a grace period.
CREATE TABLE IF NOT EXISTS remediation_links (
    link_id          BIGSERIAL    PRIMARY KEY,
    token_hash       VARCHAR(64)  NOT NULL UNIQUE,
    finding_id       BIGINT       NOT NULL REFERENCES findings(finding_id),
    owner_id         INT,
    owner_email      VARCHAR(255),
    expires_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at       TIMESTAMP WITH TIME ZONE,
    last_used_at     TIMESTAMP WITH TIME ZONE,
    use_count        INT          NOT NULL DEFAULT 0,
    created_by_user_id INT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_remediation_links_finding ON remediation_links(finding_id);
CREATE INDEX idx_remediation_links_hash ON remediation_links(token_hash);