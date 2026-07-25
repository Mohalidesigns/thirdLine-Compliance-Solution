package com.atheris.compliance.tenant.backend.modules.returns.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateReturnRequest {
    @NotBlank private String returnName;
    private String filingRegulator;
    private String returnType;
    private String frequency;
    private Integer filingDueDayOfMonth;
    private Integer filingDeadlineOffsetDays;
    private String filingChannel;
    private Integer returnOwnerUserId;
    private String returnOwnerName;
}
