package com.atheris.compliance.tenant.backend.modules.returns.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class UpdateReturnEscalationRequest {
    private Integer reminderStartValue;
    private String reminderStartUnit;
    private Integer reminderRepeatValue;
    private String reminderRepeatUnit;
    private Integer escalateToUserId;
    private String escalateToName;
    private String escalateToEmail;
}
