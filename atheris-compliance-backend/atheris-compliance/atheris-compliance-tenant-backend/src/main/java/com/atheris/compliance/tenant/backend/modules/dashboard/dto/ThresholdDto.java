package com.atheris.compliance.tenant.backend.modules.dashboard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThresholdDto {
    private Map<String, ThresholdRange> thresholds;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ThresholdRange {
        private double green;
        private double amber;
    }

    public static ThresholdDto defaults() {
        return ThresholdDto.builder()
            .thresholds(Map.of(
                "returns_on_time", new ThresholdRange(90, 70),
                "control_coverage", new ThresholdRange(80, 60)
            ))
            .build();
    }
}
