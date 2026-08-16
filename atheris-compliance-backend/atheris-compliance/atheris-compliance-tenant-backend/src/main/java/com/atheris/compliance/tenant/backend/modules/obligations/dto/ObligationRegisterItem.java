package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class ObligationRegisterItem {
    private Long obligationId;
    private String name;
    private Integer obligationNumber;
    private String description;
    private String sectionReference;
    private String areaOfFocus;
    private String obligationType;
    private String recurringDeadlineType;
    private LocalDate effectiveDate;

    private Long instrumentId;
    private String sourceTitle;
    private String regulatorAbbreviation;
    private String regulatorName;

    private String applicability;
    private String tenantRiskRating;
    private String inherentRiskRating;
    private String residualRiskRating;
    private String assignedOwnerName;
    private String assignedDepartment;
    private String status;
    private Boolean hasGap;
    private String gapDescription;
    private List<Integer> linkedControlIds;
    private Integer controlCount;
    private List<Long> linkedReturnIds;
    private List<String> returnNames;
    private Integer classificationVersion;
    private Instant classifiedAt;
    private List<SanctionItem> sanctions;

    @Data @Builder
    public static class SanctionItem {
        private String sanctionType;
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
}
