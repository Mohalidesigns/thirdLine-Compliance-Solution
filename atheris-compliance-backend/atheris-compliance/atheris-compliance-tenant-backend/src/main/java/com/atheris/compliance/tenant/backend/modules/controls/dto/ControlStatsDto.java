package com.atheris.compliance.tenant.backend.modules.controls.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data @Builder
public class ControlStatsDto {
    private long total;
    private long active;
    private long highRisk;
    private long testsDue;
    private long failingControls;
    private long openFindings;
    private List<String> themes;
    private List<String> owners;
    private List<String> acts;
    private Map<String, Long> byTheme;
    private Map<String, Long> findingsBySeverity;
    /** Aliases consumed by the shared intel register config. */
    private long totalControls;
    private Map<String, Long> byRiskLevel;
    private Map<String, Long> byStatus;
    private List<String> riskLevels;
    private List<String> statuses;
}
