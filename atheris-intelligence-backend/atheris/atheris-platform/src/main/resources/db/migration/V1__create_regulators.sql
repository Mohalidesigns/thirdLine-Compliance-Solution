CREATE TABLE IF NOT EXISTS regulators (
    regulator_id         SERIAL PRIMARY KEY,
    name                 VARCHAR(255) NOT NULL,
    abbreviation         VARCHAR(20)  NOT NULL UNIQUE,
    country              VARCHAR(100) DEFAULT 'Nigeria',
    website_url          TEXT,
    scraper_enabled      BOOLEAN DEFAULT true,
    publication_page_url TEXT,
    scraper_frequency    VARCHAR(50)  DEFAULT 'daily',
    scraper_strategy     VARCHAR(50)  DEFAULT 'html',
    pdf_link_selector    TEXT,
    pagination_enabled   BOOLEAN DEFAULT false,
    pagination_selector  TEXT,
    pagination_strategy  VARCHAR(50),
    max_pages_per_run    INT DEFAULT 3,
    max_pdf_size_mb      INT DEFAULT 100,
    historical_start_year INT DEFAULT 2022,
    request_headers      JSONB,
    scraper_last_ran_at  TIMESTAMP WITH TIME ZONE,
    scraper_last_found   INT DEFAULT 0,
    logo_url             TEXT,
    description          TEXT,
    scraper_notes        TEXT,
    is_active            BOOLEAN DEFAULT true,
    created_by           INT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_regulators_active ON regulators(is_active);
CREATE INDEX idx_regulators_abbreviation ON regulators(abbreviation);

INSERT INTO regulators (name, abbreviation, publication_page_url, scraper_strategy, scraper_frequency) VALUES
('Central Bank of Nigeria',                     'CBN',   'https://www.cbn.gov.ng/Documents/circulars.html',            'headless', '15min'),
('Securities and Exchange Commission',          'SEC',   'https://sec.gov.ng/regulations',                            'html',     'daily'),
('National Deposit Insurance Corporation',      'NDIC',  'https://ndic.gov.ng/publications',                          'html',     'weekly'),
('National Insurance Commission',               'NAICOM','https://www.naicom.gov.ng/index.php/publications',           'html',     'weekly'),
('National Pension Commission',                 'PenCom','https://www.pencom.gov.ng/publications',                     'html',     'weekly'),
('Nigerian Financial Intelligence Unit',        'NFIU',  'https://nfiu.gov.ng/index.php/publications',                 'html',     'weekly'),
('Federal Competition and Consumer Protection Commission','FCCPC','https://fccpc.gov.ng/publications',                 'html',     'weekly'),
('Nigeria Data Protection Commission',          'NDPC',  'https://ndpc.gov.ng/publications',                          'html',     'weekly'),
('Economic and Financial Crimes Commission',    'EFCC',  'https://efcc.gov.ng/publications',                          'html',     'weekly'),
('Corporate Affairs Commission',                'CAC',   'https://cac.gov.ng/publications',                           'html',     'weekly'),
('Federal Inland Revenue Service',              'FIRS',  'https://www.firs.gov.ng/publications',                      'html',     'weekly'),
('National Identity Management Commission',     'NIMC',  'https://nimc.gov.ng/publications',                          'html',     'weekly');
