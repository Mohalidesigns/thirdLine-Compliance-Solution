-- Repairs risk_matrix_config rows written with the broken RiskMatrixConfig entity defaults.
--
-- V28's column defaults were correct, but rows are created through JPA
-- (RiskMatrixConfig.builder()...build()), so the entity's @Builder.Default values
-- were written instead and the column defaults never applied. Those entity defaults
-- were wrong in three ways:
--   * likelihood axis ["Very Low","Low","Medium","High"] shares no value with the
--     ratings the app actually stores (Rare..Almost Certain), so every heatmap cell
--     matched nothing and rendered 0
--   * impact axis was a 4-level scale that is not the canonical one
--   * band_thresholds {"moderate":6,"high":9,"critical":9} made the "High" band
--     unreachable, since high == critical
--
-- Only rows still holding those exact broken values are touched, so any genuine
-- tenant customisation is preserved.

UPDATE risk_matrix_config
SET impact_levels = '["Insignificant","Minor","Moderate","Major","Severe"]'::jsonb
WHERE impact_levels = '["Low","Medium","High","Very High"]'::jsonb;

UPDATE risk_matrix_config
SET likelihood_levels = '["Rare","Unlikely","Possible","Likely","Almost Certain"]'::jsonb
WHERE likelihood_levels = '["Very Low","Low","Medium","High"]'::jsonb;

UPDATE risk_matrix_config
SET band_thresholds = '{"moderate":6,"high":12,"critical":18}'::jsonb
WHERE band_thresholds = '{"moderate":6,"high":9,"critical":9}'::jsonb;
