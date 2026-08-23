package com.atheris.compliance.tenant.backend.modules.dashboard.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class ControlCoverageDto {
    private String dimension;
    private List<CoverageRow> rows;
    private Summary summary;

    @Data
    @Builder
    public static class CoverageRow {
        private String name;
        private Long id;
        private int totalObligations;
        private int covered;
        private int gaps;
        private double coveragePercentage;
        private String color;
    }

    @Data
    @Builder
    public static class Summary {
        private int totalObligations;
        private int totalCovered;
        private int totalGaps;
        private double overallCoveragePercentage;
        private String overallColor;
    }
}
