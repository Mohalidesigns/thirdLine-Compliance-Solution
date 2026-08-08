package com.atheris.compliance.tenant.backend.modules.org.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OwnerRequest {
    @NotBlank
    private String fullName;
    private String email;
    private String jobTitle;
    private Integer teamId;
    private Integer departmentId;
    private Integer userId;
    private Boolean isActive;
}
