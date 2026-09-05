package com.atheris.compliance.intelligence.backend.modules.sanctions.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data @Builder
public class AdminSanctionDto {
    private Long sanctionId;
    private String sanctionType;
    private BigDecimal sanctionAmountNaira;
    private Boolean sanctionAmountPerDay;
    private List<String> liableRoles;
    private Integer severityScore;
    private Boolean hasBeenEnforced;
    private String sourceSectionReference;
    private Long regulationId;
    private String actName;
    private Long instrumentId;
}
