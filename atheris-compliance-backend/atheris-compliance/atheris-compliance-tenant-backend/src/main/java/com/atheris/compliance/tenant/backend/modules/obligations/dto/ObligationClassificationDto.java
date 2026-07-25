package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data
@Builder
public class ObligationClassificationDto {
    private Long instrumentId;
    private Long obligationId;
    private String applicability;
    private String applicabilityReasoning;
    private String tenantRiskRating;
    private String riskJustification;
    private String riskType;
    private String impactRating;
    private String impactJustification;
    private String likelihoodRating;
    private String likelihoodJustification;
    private String inherentRiskRating;
    private String residualRiskRating;
    private Integer assignedOwnerUserId;
    private String assignedOwnerName;
    private String assignedDepartment;
    private List<Integer> linkedControlIds;
    private Boolean hasGap;
    private String gapDescription;
    private String status;
    private Integer classificationVersion;
    private Instant classifiedAt;
    private Instant updatedAt;
}
