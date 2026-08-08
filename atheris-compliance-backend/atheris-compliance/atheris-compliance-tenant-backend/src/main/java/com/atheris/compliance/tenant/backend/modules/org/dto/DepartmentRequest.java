package com.atheris.compliance.tenant.backend.modules.org.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DepartmentRequest {
    @NotBlank
    private String name;
    private String code;
    private Integer headOwnerId;
    private Boolean isActive;
}
