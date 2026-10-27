package com.atheris.compliance.tenant.backend.modules.returns.dto;

import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationLevelDto;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ReturnEscalationResponse {
    private Long policyId;
    private String policyName;
    private String frequencyScope;
    private Boolean isDefault;
    @Builder.Default
    private Boolean active = true;
    private Integer reminderStartValue;
    private String reminderStartUnit;
    private Integer reminderRepeatValue;
    private String reminderRepeatUnit;
    private Boolean sendLink;
    private Boolean notifyOnStart;
    @Builder.Default
    private List<EscalationLevelDto> levels = List.of();
}
