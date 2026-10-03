package com.atheris.compliance.intelligence.backend.modules.sanctions.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class AdminSanctionDetailDto {
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
    private String actAbbreviation;
    private Long instrumentId;
    private String instrumentTitle;
    private String description;
    private String riskExplanation;
    private String penaltyDetails;
    private BigDecimal personalLiabilityNaira;
    private LocalDate recentEnforcementDate;
    private BigDecimal recentEnforcementAmount;
    private Instant createdAt;
    private Instant updatedAt;
}
