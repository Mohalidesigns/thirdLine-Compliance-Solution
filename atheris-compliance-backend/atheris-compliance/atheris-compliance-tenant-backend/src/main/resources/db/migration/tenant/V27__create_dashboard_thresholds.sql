CREATE TABLE dashboard_thresholds (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    green_min DOUBLE PRECISION NOT NULL DEFAULT 90,
    amber_min DOUBLE PRECISION NOT NULL DEFAULT 70,
    CONSTRAINT uq_threshold_tenant_metric UNIQUE (tenant_id, metric_name)
);
