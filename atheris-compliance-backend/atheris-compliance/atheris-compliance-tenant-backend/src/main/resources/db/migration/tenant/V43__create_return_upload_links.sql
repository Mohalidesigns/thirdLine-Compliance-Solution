-- Secure, account-less links that let a return's owner record an event filing (trigger date +
-- evidence/reference) for an event-driven return. Only a SHA-256 hash of the token is stored.
CREATE TABLE IF NOT EXISTS return_upload_links (
    link_id            BIGSERIAL    PRIMARY KEY,
    token_hash         VARCHAR(64)  NOT NULL UNIQUE,
    return_id          BIGINT       NOT NULL REFERENCES regulatory_returns(return_id),
    recipient_email    VARCHAR(255),
    recipient_name     VARCHAR(255),
    expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at         TIMESTAMP WITH TIME ZONE,
    last_used_at       TIMESTAMP WITH TIME ZONE,
    use_count          INT          NOT NULL DEFAULT 0,
    created_by_user_id INT,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_upload_links_return ON return_upload_links(return_id);
CREATE INDEX IF NOT EXISTS idx_return_upload_links_hash ON return_upload_links(token_hash);
