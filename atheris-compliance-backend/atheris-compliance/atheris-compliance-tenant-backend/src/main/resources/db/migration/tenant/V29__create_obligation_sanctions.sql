CREATE TABLE IF NOT EXISTS obligation_sanctions (
    obligation_id BIGINT NOT NULL REFERENCES obligations(obligation_id) ON DELETE CASCADE,
    sanction_id BIGINT NOT NULL REFERENCES regulatory_sanctions(sanction_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (obligation_id, sanction_id)
);
CREATE INDEX idx_obligation_sanctions_obligation ON obligation_sanctions(obligation_id);
CREATE INDEX idx_obligation_sanctions_sanction ON obligation_sanctions(sanction_id);
