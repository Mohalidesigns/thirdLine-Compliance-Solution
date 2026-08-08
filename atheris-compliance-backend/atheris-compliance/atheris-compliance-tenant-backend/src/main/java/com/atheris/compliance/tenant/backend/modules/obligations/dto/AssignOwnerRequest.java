package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Data;

@Data
public class AssignOwnerRequest {
    private Integer assignedOwnerId;
    private String changeReason;
}
