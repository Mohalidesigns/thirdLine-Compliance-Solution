package com.atheris.compliance.tenant.backend.modules.org.dto;

import lombok.Data;

@Data
public class StakeholderTitleRequest {
    private String name;
    private Integer defaultDepartmentId;
    private Integer defaultUnitId;
}
