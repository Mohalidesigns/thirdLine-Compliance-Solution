package com.atheris.tenant.modules.findings.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDate;

@Data
public class RaiseRemediationRequest {
    @NotNull private Integer assignedToUserId;
    @NotNull private LocalDate remediationDeadline;
}
