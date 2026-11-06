package com.atheris.compliance.tenant.backend.modules.controls.dto;

import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationLevelRequest;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ControlEscalationRequest {
    private Integer reminderStartValue;
    private String reminderStartUnit;
    private Integer reminderRepeatValue;
    private String reminderRepeatUnit;
    private List<EscalationLevelRequest> levels;
}
