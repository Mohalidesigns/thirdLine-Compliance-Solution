CREATE TABLE IF NOT EXISTS regulator_recommendations (
    id              SERIAL PRIMARY KEY,
    licence_type    VARCHAR(100) NOT NULL,
    regulator_id    INT NOT NULL,
    sort_order      INT DEFAULT 0,
    UNIQUE(licence_type, regulator_id)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_licence ON regulator_recommendations(licence_type);

INSERT INTO regulator_recommendations (licence_type, regulator_id, sort_order) VALUES
    ('Commercial Bank', 1, 1),
    ('Commercial Bank', 3, 2),
    ('Commercial Bank', 6, 3),
    ('Commercial Bank', 8, 4),
    ('Merchant Bank', 1, 1),
    ('Merchant Bank', 3, 2),
    ('Merchant Bank', 6, 3),
    ('Merchant Bank', 8, 4),
    ('Microfinance Bank', 1, 1),
    ('Microfinance Bank', 3, 2),
    ('Microfinance Bank', 6, 3),
    ('Fintech / Payment Service Provider', 1, 1),
    ('Fintech / Payment Service Provider', 6, 2),
    ('Fintech / Payment Service Provider', 8, 3),
    ('Fintech / Payment Service Provider', 7, 4),
    ('Pension Fund Administrator', 5, 1),
    ('Pension Fund Administrator', 8, 2),
    ('Pension Fund Administrator', 11, 3),
    ('Insurance Company', 4, 1),
    ('Insurance Company', 8, 2),
    ('Insurance Company', 11, 3),
    ('Capital Market Dealer', 2, 1),
    ('Capital Market Dealer', 8, 2),
    ('Capital Market Dealer', 10, 3),
    ('Bureau de Change', 1, 1),
    ('Bureau de Change', 6, 2),
    ('Bureau de Change', 9, 3)
ON CONFLICT (licence_type, regulator_id) DO NOTHING;
