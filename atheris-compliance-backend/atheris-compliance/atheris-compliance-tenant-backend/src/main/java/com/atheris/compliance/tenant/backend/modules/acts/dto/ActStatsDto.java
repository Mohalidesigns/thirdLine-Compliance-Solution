package com.atheris.compliance.tenant.backend.modules.acts.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data @Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ActStatsDto {
    private long totalActs;
    /** Acts whose instrument has obligations in this tenant's register. */
    private long actsInRegister;
    @Builder.Default private Map<String, Long> byRegulator = new LinkedHashMap<>();
    @Builder.Default private List<String> regulators = List.of();
}
