package com.atheris.compliance.tenant.backend.modules.returns.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.time.LocalDate;

@Data
public class CreateReturnRequest {
    @NotBlank private String returnName;
    private String filingRegulator;
    private Long tenantRegulatorId;
    private Long actId;
    private String returnType;
    private String frequency;
    private LocalDate filingDate;
    private Integer filingDeadlineOffsetDays;
    private String filingChannel;
    private Integer returnOwnerUserId;
    private String returnOwnerName;
    private String responsibleUnit;
    private String responsiblePerson;
}