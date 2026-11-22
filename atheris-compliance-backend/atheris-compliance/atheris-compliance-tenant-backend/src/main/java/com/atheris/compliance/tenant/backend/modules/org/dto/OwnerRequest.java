package com.atheris.compliance.tenant.backend.modules.org.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class OwnerRequest {
    @NotBlank
    private String fullName;
    @NotBlank
    private String email;
    private Integer titleId;
    private Integer teamId;
    @NotNull
    private Integer departmentId;
    private Integer userId;
    private Boolean isActive;
}
