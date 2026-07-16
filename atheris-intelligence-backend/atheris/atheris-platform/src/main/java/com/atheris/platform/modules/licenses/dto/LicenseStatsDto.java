package com.atheris.platform.modules.licenses.dto;

import lombok.Builder;
import lombok.Data;
import java.util.Map;

@Data @Builder
public class LicenseStatsDto {
    private long total;
    private long active;
    private long inactive;
    private long expired;
    private long revoked;
    private long gracePeriod;
    private long suspended;
    private Map<String, Long> byStatus;
}
