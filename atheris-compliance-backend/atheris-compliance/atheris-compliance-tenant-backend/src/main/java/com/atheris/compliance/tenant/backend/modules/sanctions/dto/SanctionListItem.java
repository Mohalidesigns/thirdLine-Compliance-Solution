package com.atheris.compliance.tenant.backend.modules.sanctions.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class SanctionListItem {
    private Long sanctionId;
    private Long instrumentId;
    private Long actId;
    private String actName;
    private String actAbbreviation;
    private String sanctionType;
    /** Penalty types from the source data (real list; falls back to {@link #sanctionType}). */
    private List<String> penaltyType;
    private BigDecimal sanctionAmountNaira;
    private Boolean sanctionAmountPerDay;
    private BigDecimal personalLiabilityNaira;
    private List<String> liableRoles;
    private Integer severityScore;
    private Boolean hasBeenEnforced;
    private LocalDate recentEnforcementDate;
    private BigDecimal recentEnforcementAmount;
    private String description;
    private String sourceSectionReference;
    private String riskExplanation;
    private String penaltyDetails;
    private String instrumentTitle;
    private Instant createdAt;
    private Instant updatedAt;
}
