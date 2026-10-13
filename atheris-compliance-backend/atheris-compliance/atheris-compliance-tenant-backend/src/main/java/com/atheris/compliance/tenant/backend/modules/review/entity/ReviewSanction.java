package com.atheris.compliance.tenant.backend.modules.review.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewSanction {
    private String sanctionType;
    private List<String> penaltyType;
    private BigDecimal amountNaira;
    @Builder.Default private Boolean sanctionAmountPerDay = false;
    private BigDecimal personalLiabilityNaira;
    private List<String> liableRoles;
    private Integer severityScore;
    @Builder.Default private Boolean hasBeenEnforced = false;
    private LocalDate recentEnforcementDate;
    private BigDecimal recentEnforcementAmount;
    private String description;
    private String sourceSectionReference;
    private String riskExplanation;
    private String penaltyDetails;
    private Long regulationId;
    private String actName;
    private String actAbbreviation;
    private String instrumentTitle;
}
