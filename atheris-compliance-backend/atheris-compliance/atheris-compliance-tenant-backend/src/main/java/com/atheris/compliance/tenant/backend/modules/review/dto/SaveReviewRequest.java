package com.atheris.compliance.tenant.backend.modules.review.dto;

import lombok.Data;
import java.util.List;

@Data
public class SaveReviewRequest {
    private String changeReason;
    private List<ObligationDto> obligations;

    @Data
    public static class ObligationDto {
        private Integer obligationNumber;
        private String description;
        private String sectionReference;
        private String areaOfFocus;
        private String obligationType;
        private String recurringDeadlineType;
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
