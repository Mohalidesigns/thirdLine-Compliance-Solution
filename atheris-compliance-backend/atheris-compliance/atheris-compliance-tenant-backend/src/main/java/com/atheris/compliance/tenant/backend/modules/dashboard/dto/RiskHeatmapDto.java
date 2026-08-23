package com.atheris.compliance.tenant.backend.modules.dashboard.dto;

import lombok.*;
import java.util.List;
import java.util.Map;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RiskHeatmapDto {
    private List<String> impactLevels;
    private List<String> likelihoodLevels;
    private List<HeatmapCell> cells;
    private Summary summary;
    private Map<String, String> bandColors;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class HeatmapCell {
        private String impact;
        private String likelihood;
        private int score;
        private int count;
        private String band;
        private boolean hasGaps;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Summary {
        private int total;
        private int low;
        private int moderate;
        private int high;
        private int critical;
    }
}
