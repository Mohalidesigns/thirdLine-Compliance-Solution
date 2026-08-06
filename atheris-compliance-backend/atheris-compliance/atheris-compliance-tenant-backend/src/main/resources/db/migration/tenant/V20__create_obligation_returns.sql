CREATE TABLE IF NOT EXISTS obligation_returns (
    obligation_id BIGINT NOT NULL REFERENCES obligations(obligation_id),
    return_id     BIGINT NOT NULL REFERENCES regulatory_returns(return_id),
    linked_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (obligation_id, return_id)
);

CREATE INDEX idx_obligation_returns_obligation ON obligation_returns(obligation_id);
CREATE INDEX idx_obligation_returns_return ON obligation_returns(return_id);
