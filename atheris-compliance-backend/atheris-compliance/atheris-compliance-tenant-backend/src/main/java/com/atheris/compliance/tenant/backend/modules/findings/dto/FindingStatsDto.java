package com.atheris.compliance.tenant.backend.modules.findings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.LinkedHashMap;
import java.util.Map;

/** Findings page KPI counts (GET /findings/stats). */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class FindingStatsDto {
    @Builder.Default private long total = 0;
    @Builder.Default private long open = 0;
    @Builder.Default private long inRemediation = 0;
    @Builder.Default private long remediated = 0;
    @Builder.Default private long closed = 0;
    @Builder.Default private long overdue = 0;
    @Builder.Default private long criticalHigh = 0;
    @Builder.Default private Map<String, Long> bySeverity = new LinkedHashMap<>();
}
