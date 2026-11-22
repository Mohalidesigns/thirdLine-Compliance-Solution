package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StakeholderAssignmentDto {
    private Long assignmentId;
    private String subjectType;
    private Long subjectId;
    private Integer stakeholderId;
    private Integer roleId;
    private String roleCode;
    private String roleName;
}
