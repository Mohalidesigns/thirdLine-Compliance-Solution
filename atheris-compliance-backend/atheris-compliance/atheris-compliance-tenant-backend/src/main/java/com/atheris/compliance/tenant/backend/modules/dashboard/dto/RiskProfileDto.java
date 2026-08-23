package com.atheris.compliance.tenant.backend.modules.dashboard.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class RiskProfileDto {
    private List<RiskRow> riskLevels;
    private List<AreaRow> byAreaOfFocus;
    private Summary summary;

    @Data
    @Builder
    public static class RiskRow {
        private String level;
        private int count;
        private double percentage;
    }

    @Data
    @Builder
    public static class AreaRow {
        private String areaOfFocus;
        private int total;
        private int extreme;
        private int high;
        private int medium;
        private int low;
        private int gaps;
    }

    @Data
    @Builder
    public static class Summary {
        private int totalApplicable;
        private int extremeCount;
        private int highCount;
        private int mediumCount;
        private int lowCount;
        private int gapsCount;
    }
}
