package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StakeholderTitleDto {
    private Integer titleId;
    private String name;
    private Integer defaultDepartmentId;
    private String defaultDepartmentName;
    private Integer defaultUnitId;
    private String defaultUnitName;
    private Boolean isActive;
    private Integer sortOrder;
}
