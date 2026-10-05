CREATE TABLE federal_public_holidays (
    holiday_id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    holiday_date DATE NOT NULL,
    observed_date DATE,
    name VARCHAR(200) NOT NULL,
    jurisdiction VARCHAR(20) NOT NULL DEFAULT 'FEDERAL',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_federal_public_holiday UNIQUE (tenant_id, jurisdiction, holiday_date)
);

CREATE INDEX idx_federal_public_holidays_tenant_dates
    ON federal_public_holidays (tenant_id, holiday_date, observed_date);

CREATE UNIQUE INDEX uq_federal_public_holidays_observed_date
    ON federal_public_holidays (tenant_id, observed_date)
    WHERE observed_date IS NOT NULL;

ALTER TABLE federal_public_holidays
    ADD CONSTRAINT ck_federal_public_holiday_jurisdiction CHECK (jurisdiction = 'FEDERAL');
