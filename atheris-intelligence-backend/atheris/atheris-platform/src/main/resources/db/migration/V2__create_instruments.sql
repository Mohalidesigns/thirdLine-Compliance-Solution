CREATE TABLE IF NOT EXISTS instruments (
    instrument_id              BIGSERIAL PRIMARY KEY,
    regulator_id               INT NOT NULL REFERENCES regulators(regulator_id),
    type_id                    INT,
    source_title               VARCHAR(500) NOT NULL,
    source_reference_number    VARCHAR(100),
    date_issued                DATE,
    date_commencement          DATE,
    date_superseded            DATE,
    area_of_focus              VARCHAR(255),
    theme_id                   INT,
    nature                     VARCHAR(50),
    risk_rating                VARCHAR(20),
    licence_types_applicable   JSONB,
    product_lines_applicable   JSONB,
    applicability_confidence   FLOAT,
    applicability_notes        TEXT,
    pdf_url                    TEXT,
    pdf_ocr_text               TEXT,
    pdf_hash                   VARCHAR(64),
    source_url                 TEXT,
    source_page_url            TEXT,
    source_page_snapshot_url   TEXT,
    source_page_hash           TEXT,
    published_at               DATE,
    discovered_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_published_at         TIMESTAMP WITH TIME ZONE,
    status                     VARCHAR(50) DEFAULT 'Triage',
    upload_source              VARCHAR(50) DEFAULT 'scraper',
    uploaded_by                INT,
    is_historical_backfill     BOOLEAN DEFAULT false,
    ai_summary                 TEXT,
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_instruments_source_url ON instruments(source_url) WHERE source_url IS NOT NULL;
CREATE UNIQUE INDEX idx_instruments_pdf_hash   ON instruments(pdf_hash)   WHERE pdf_hash IS NOT NULL;
CREATE INDEX idx_instruments_regulator_status  ON instruments(regulator_id, status);
CREATE INDEX idx_instruments_risk_rating       ON instruments(risk_rating);
CREATE INDEX idx_instruments_area_of_focus     ON instruments(area_of_focus);

-- Full text search index
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(source_title,'') || ' ' ||
            coalesce(area_of_focus,'') || ' ' ||
            coalesce(ai_summary,'')
        )
    ) STORED;

CREATE INDEX idx_instruments_fts ON instruments USING GIN(search_vector);
