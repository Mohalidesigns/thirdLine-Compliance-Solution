package com.atheris.compliance.tenant.backend.modules.review.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class SaveReviewRequest {
    private String changeReason;
    private List<ObligationDto> obligations;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ObligationDto {
        private Integer obligationNumber;
        private String title;
        private String description;
        private String plainEnglishStatement;
        private String sectionReference;
        private String areaOfFocus;
        private String obligationType;
        private String recurringDeadlineType;
        private String riskDescription;
        private String inherentLikelihood;
        private String inherentImpact;
        private String inherentRiskRating;
        private String controlOwner;
        private Long regulationId;
        private String actName;
        private Boolean applicable;

        private String applicability;
        private String applicabilityReasoning;
        private String tenantRiskRating;
        private String riskJustification;
        private String riskType;
        private String impactRating;
        private String impactJustification;
        private String likelihoodRating;
        private String likelihoodJustification;
        private Integer assignedOwnerUserId;
        private Integer assignedOwnerId;
        private String assignedOwnerName;
        private String assignedDepartment;
        private Boolean hasGap;
        private String gapDescription;
        private List<Long> linkedReturnIds;
    }
}
