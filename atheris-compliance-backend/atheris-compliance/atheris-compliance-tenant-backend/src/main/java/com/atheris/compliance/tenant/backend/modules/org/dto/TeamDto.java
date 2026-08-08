package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TeamDto {
    private Integer teamId;
    private Integer departmentId;
    private String departmentName;
    private String name;
    private Boolean isActive;
    private Integer ownerCount;
}
