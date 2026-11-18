package com.atheris.compliance.tenant.backend.modules.controls.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;

@Data
public class RecordTestRequest {
    @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) private LocalDate testDate;
    private String testedByName;
    @NotBlank private String result;
    private String resultDescription;
    private String failureSeverity;
    private Boolean remediationRequired;
    private Integer remediationOwnerUserId;
    private Integer remediationOwnerId;
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) private LocalDate remediationDeadline;
}
