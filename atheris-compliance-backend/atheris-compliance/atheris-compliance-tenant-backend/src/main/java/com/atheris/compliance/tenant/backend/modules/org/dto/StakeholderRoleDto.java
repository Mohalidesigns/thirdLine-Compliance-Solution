package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StakeholderRoleDto {
    private Integer roleId;
    private String code;
    private String name;
    private String description;
    private Boolean isDefault;
    private Boolean isActive;
    private Integer sortOrder;
}
