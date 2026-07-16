package com.atheris.compliance.tenant.backend.modules.controls.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDate;

@Data
public class RecordTestRequest {
    @NotNull private LocalDate testDate;
    @NotBlank private String result;
    private String resultDescription;
    private String failureDetails;
    private String failureSeverity;
    private String evidenceUrl;
    private Boolean remediationRequired;
    private Integer remediationOwnerUserId;
    private LocalDate remediationDeadline;
}
