package com.atheris.tenant.modules.obligations.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

@Data
public class ClassifyObligationRequest {
    @NotBlank private String applicability;
    private String applicabilityReasoning;
    private String tenantRiskRating;
    private String riskJustification;
    private Integer assignedOwnerUserId;
    private List<Integer> linkedControlIds;
    private Boolean hasGap;
    private String gapDescription;
    private String changeReason;
}
