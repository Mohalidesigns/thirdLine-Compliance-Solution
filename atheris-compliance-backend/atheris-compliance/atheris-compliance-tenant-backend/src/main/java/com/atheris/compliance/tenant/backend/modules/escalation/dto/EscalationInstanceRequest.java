package com.atheris.compliance.tenant.backend.modules.escalation.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class EscalationInstanceRequest {
    private Integer reminderStartValue;
    private String reminderStartUnit;
    private Integer reminderRepeatValue;
    private String reminderRepeatUnit;
    private Boolean sendLink;
    private Boolean active;
    @Builder.Default
    private List<EscalationLevelRequest> levels = List.of();
}
