package com.atheris.compliance.tenant.backend.modules.sanctions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data @Builder
public class SanctionStatsDto {
    private long total;
    private long enforced;
    private long highSeverity;
    private java.math.BigDecimal totalExposure;
    private List<String> sanctionTypes;
    private List<String> actNames;
    /** Aliases consumed by the shared intel register config. */
    private Map<String, Long> byPenaltyType;
    private List<ActExposure> byActExposure;
    private Map<String, Long> enforcedByPenaltyType;
    private List<String> penaltyTypes;
    private List<String> liableRoles;
    private List<ActOption> acts;

    @Data @Builder @AllArgsConstructor
    public static class ActExposure {
        private Long actId;
        private String name;
        private java.math.BigDecimal amount;
    }

    @Data @Builder @AllArgsConstructor
    public static class ActOption {
        private Long actId;
        private String name;
    }
}
