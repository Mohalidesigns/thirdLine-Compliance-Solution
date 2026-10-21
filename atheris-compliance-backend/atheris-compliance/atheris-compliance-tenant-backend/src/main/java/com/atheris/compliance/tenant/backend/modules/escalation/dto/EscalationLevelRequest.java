package com.atheris.compliance.tenant.backend.modules.escalation.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class EscalationLevelRequest {
    private Integer levelNo;
    private Integer afterValue;
    private String afterUnit;
    private String targetType;
    private String targetRole;
    private Integer targetUserId;
    private String targetName;
    private String targetEmail;
}
