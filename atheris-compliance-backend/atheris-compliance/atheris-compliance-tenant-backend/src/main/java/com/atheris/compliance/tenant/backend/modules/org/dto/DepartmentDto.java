package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DepartmentDto {
    private Integer departmentId;
    private String name;
    private String code;
    private Integer headOwnerId;
    private String headOwnerName;
    private Boolean isActive;
    private Integer teamCount;
    private Integer ownerCount;
}
