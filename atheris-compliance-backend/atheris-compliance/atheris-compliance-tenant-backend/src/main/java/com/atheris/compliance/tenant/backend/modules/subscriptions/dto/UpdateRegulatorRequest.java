package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.Data;

@Data
public class UpdateRegulatorRequest {
    private String name;
    private String abbreviation;
    private Integer platformRegulatorId;
    private String description;
    private Boolean isActive;
}
