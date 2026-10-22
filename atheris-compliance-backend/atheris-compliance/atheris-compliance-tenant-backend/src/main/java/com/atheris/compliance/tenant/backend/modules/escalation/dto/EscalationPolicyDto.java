package com.atheris.compliance.tenant.backend.modules.escalation.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class EscalationPolicyDto {
    private Long policyId;
    private String name;
    private String subjectType;
    private Boolean isDefault;
    private Boolean isActive;
    private Integer reminderStartValue;
    private String reminderStartUnit;
    private Integer reminderRepeatValue;
    private String reminderRepeatUnit;
    private Boolean sendLink;
    private String frequencyScope;
    @Builder.Default
    private List<EscalationLevelDto> levels = List.of();
    private Instant createdAt;
    private Instant updatedAt;
}
