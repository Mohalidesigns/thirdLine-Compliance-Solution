package com.atheris.compliance.tenant.backend.modules.findings.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDate;

@Data
public class RaiseRemediationRequest {
    @NotNull private Integer assignedToOwnerId;
    private LocalDate remediationDeadline;
    /** Required when the deadline goes past the finding's SLA (created + SLA days). */
    private String deadlineJustification;
}
