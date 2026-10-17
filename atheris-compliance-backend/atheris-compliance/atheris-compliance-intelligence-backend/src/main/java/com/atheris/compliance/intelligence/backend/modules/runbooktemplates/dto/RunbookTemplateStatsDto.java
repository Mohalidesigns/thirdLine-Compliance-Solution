package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RunbookTemplateStatsDto {
    @Builder.Default private long total = 0;
    @Builder.Default private long totalSteps = 0;
    @Builder.Default private Map<String, Long> byCategory = Map.of();
    @Builder.Default private Map<String, Long> byCriticality = Map.of();
    @Builder.Default private Map<String, Long> byStatus = Map.of();
    /** criticality → category → template count (KPI card dropdowns). */
    @Builder.Default private Map<String, Map<String, Long>> byCriticalityCategory = Map.of();
    /** category → total steps across its templates. */
    @Builder.Default private Map<String, Long> stepsByCategory = Map.of();
}
