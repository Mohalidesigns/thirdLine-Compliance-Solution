package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class TenantRegulatorDto {
    private Long id;
    private String name;
    private String abbreviation;
    private Integer platformRegulatorId;
    private String description;
    private Boolean isActive;
}
