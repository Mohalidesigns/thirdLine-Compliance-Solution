package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Data;

@Data
public class RiskAssessmentRequest {
    private String tenantRiskRating;
    private String riskJustification;
    private String impactRating;
    private String impactJustification;
    private String likelihoodRating;
    private String likelihoodJustification;
    private String changeReason;
}
