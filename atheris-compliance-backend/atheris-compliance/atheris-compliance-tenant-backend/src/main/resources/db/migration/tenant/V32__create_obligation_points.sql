CREATE TABLE obligation_points (
    id BIGSERIAL PRIMARY KEY,
    obligation_id BIGINT NOT NULL REFERENCES obligations(obligation_id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES obligation_points(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    marker VARCHAR(20),
    level INT NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    point_type VARCHAR(20) NOT NULL DEFAULT 'verbatim',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_points_obligation ON obligation_points(obligation_id);
CREATE INDEX idx_points_parent ON obligation_points(parent_id);
