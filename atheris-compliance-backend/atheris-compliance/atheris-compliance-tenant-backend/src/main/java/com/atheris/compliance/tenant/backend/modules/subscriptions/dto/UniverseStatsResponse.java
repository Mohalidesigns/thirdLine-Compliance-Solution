package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The tenant's compliance universe — the same instrument set the Instruments page lists
 * (subscribed regulators, confirmed into the register) — aggregated for the dashboard.
 * Every map is ordered by count, highest first.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class UniverseStatsResponse {
    private long total;
    @Builder.Default
    private Map<String, Long> byRiskRating = new LinkedHashMap<>();
    @Builder.Default
    private Map<String, Long> byRegulator = new LinkedHashMap<>();
    @Builder.Default
    private Map<String, Long> byNature = new LinkedHashMap<>();
    @Builder.Default
    private Map<String, Long> byAreaOfFocus = new LinkedHashMap<>();
    @Builder.Default
    private Map<String, Long> byStatus = new LinkedHashMap<>();
    /** risk rating → (regulator → count), for the per-risk KPI breakdowns. */
    @Builder.Default
    private Map<String, Map<String, Long>> regulatorsByRisk = new LinkedHashMap<>();
}
