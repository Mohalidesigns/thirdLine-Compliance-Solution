package com.atheris.compliance.tenant.backend.modules.findings.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDate;

@Data
public class RaiseFindingRequest {
    @NotBlank private String findingType;
    @NotBlank private String severity;
    @NotBlank private String description;
    private String rootCause;
    private Long linkedObligationId;
    private Integer linkedControlId;
    private Integer assignedToOwnerId;
    @NotNull private LocalDate remediationDeadline;
}
