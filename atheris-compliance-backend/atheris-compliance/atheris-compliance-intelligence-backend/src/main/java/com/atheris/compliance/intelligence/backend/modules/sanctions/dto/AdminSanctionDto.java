package com.atheris.compliance.intelligence.backend.modules.sanctions.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Single paginated sanction DTO for both the explorer list and the detail page — the list
 * carries every field (no separate detail DTO), so the register columns and the detail view
 * bind to the same shape.
 */
@Data @Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class AdminSanctionDto {
    private Long sanctionId;
    private String sanctionType;
    private BigDecimal sanctionAmountNaira;
    private Boolean sanctionAmountPerDay;
    private List<String> liableRoles;
    private List<String> penaltyType;
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