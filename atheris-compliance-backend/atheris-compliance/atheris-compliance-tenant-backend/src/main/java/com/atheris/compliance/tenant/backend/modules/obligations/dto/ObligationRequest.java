package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
public class ObligationRequest {
    private Long instrumentId;
    @NotBlank private String name;
    private String description;
    private String obligationType;
    private String recurringDeadlineType;
    private LocalDate effectiveDate;
    private Boolean hasGap;
    private String gapDescription;
    private List<Integer> linkedControlIds;
    private String changeReason;
}