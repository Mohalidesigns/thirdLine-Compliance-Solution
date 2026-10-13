package com.atheris.compliance.tenant.backend.modules.sanctions.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data @Builder
public class SanctionListItem {
    private Long sanctionId;
    private Long instrumentId;
    private Long actId;
    private String actName;
    private String sanctionType;
    /** Alias of {@link #sanctionType} as a list, so the shared intel penalty-type column can bind. */
    private List<String> penaltyType;
    private BigDecimal sanctionAmountNaira;
    private Boolean sanctionAmountPerDay;
    private List<String> liableRoles;
    private Integer severityScore;
    private Boolean hasBeenEnforced;
    private String description;
    private String sourceSectionReference;
    private String riskExplanation;
    private String penaltyDetails;
}
