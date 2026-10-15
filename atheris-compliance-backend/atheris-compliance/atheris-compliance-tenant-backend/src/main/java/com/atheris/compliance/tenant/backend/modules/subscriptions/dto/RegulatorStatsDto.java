package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegulatorStatsDto {

    private long total;
    private long sanctions;
    private long obligations;
    private long returns;
    private Map<String, Long> totalBreakdown;
    private Map<String, Long> sanctionsBreakdown;
    private Map<String, Long> obligationsBreakdown;
    private Map<String, Long> returnsBreakdown;
}
