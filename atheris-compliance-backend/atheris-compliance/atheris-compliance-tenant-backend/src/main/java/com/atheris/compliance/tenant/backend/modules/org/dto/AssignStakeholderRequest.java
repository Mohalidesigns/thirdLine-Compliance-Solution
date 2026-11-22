package com.atheris.compliance.tenant.backend.modules.org.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AssignStakeholderRequest {
    @NotBlank
    private String subjectType;
    @NotNull
    private Long subjectId;
    @NotBlank
    private String roleCode;
}
