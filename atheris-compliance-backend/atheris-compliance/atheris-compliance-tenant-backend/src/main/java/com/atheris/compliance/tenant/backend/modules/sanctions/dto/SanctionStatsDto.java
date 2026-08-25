package com.atheris.compliance.tenant.backend.modules.sanctions.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data @Builder
public class SanctionStatsDto {
    private long total;
    private long enforced;
    private long highSeverity;
    private java.math.BigDecimal totalExposure;
    private List<String> sanctionTypes;
    private List<String> regulationNames;
}
