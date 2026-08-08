package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OwnerDto {
    private Integer ownerId;
    private String fullName;
    private String email;
    private String jobTitle;
    private Integer teamId;
    private String teamName;
    private Integer departmentId;
    private String departmentName;
    private Integer userId;
    private Boolean isActive;
}
