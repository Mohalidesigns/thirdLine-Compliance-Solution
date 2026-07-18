package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateRegulatorRequest {
    @NotBlank private String name;
    private String abbreviation;
    private Integer platformRegulatorId;
    private String description;
}
