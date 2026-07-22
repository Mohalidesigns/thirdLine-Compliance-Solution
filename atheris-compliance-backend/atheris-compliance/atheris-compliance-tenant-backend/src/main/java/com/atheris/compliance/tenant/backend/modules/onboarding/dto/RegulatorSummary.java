package com.atheris.compliance.tenant.backend.modules.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RegulatorSummary {
    private Integer regulatorId;
    private String name;
    private String abbreviation;
}
