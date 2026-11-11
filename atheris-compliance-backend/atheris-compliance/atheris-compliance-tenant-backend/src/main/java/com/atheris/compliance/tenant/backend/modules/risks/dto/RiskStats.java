package com.atheris.compliance.tenant.backend.modules.risks.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data @Builder
public class RiskStats {
    private long total;
    private long active;
    private Map<String, Long> byBand;
    private Map<String, Long> byResidualBand;
    private long unmanaged;
}
