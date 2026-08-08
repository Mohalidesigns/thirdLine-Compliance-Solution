package com.atheris.compliance.tenant.backend.modules.org.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TeamRequest {
    @NotBlank
    private String name;
    private Integer departmentId;
    private Boolean isActive;
}
