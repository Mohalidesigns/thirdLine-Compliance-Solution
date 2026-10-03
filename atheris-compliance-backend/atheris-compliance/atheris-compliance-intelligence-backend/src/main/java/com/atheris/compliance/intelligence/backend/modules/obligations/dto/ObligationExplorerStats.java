package com.atheris.compliance.intelligence.backend.modules.obligations.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Explorer KPIs + filter options (ObligationsExplorerPage) and the distribution fields read by the
 * dashboard's RegulatoryCoverage section (totalObligations, highRiskCount, areaCount, by*).
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ObligationExplorerStats {
    // explorer page
    private long total;
    private long highRisk;
    private long withPoints;
    private long withoutPoints;
    @Builder.Default
    private List<String> regulators = List.of();
    @Builder.Default
    private List<String> areas = List.of();
    @Builder.Default
    private List<String> risks = List.of();
    @Builder.Default
    private List<String> acts = List.of();

    // dashboard RegulatoryCoverage
    private long totalObligations;
    private long highRiskCount;
    private long areaCount;
    @Builder.Default
    private Map<String, Long> byRiskRating = Map.of();
    @Builder.Default
    private Map<String, Long> byAreaOfFocus = Map.of();
    @Builder.Default
    private Map<String, Long> byObligationType = Map.of();
    @Builder.Default
    private List<String> riskRatings = List.of();
    @Builder.Default
    private List<String> areasOfFocus = List.of();
    @Builder.Default
    private List<String> obligationTypes = List.of();
}
