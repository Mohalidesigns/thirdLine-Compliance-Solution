package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

@Data
public class ClassifyObligationRequest {
    @NotBlank private String applicability;
    private String applicabilityReasoning;
    private String tenantRiskRating;
    private String riskJustification;
    private String riskType;
    private String impactRating;
    private String impactJustification;
    private String likelihoodRating;
    private String likelihoodJustification;
    private String inherentRiskRating;
    private Integer assignedOwnerUserId;
    private String assignedOwnerName;
    private String assignedDepartment;
    private List<Integer> linkedControlIds;
    private Boolean hasGap;
    private String gapDescription;
    private String changeReason;
}
