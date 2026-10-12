package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data @Builder
public class AdminControlDetailDto {
    private Long complianceControlId;
    private String controlNumber;
    private String theme;
    private String complianceArea;
    private String riskLevel;
    private String frequency;
    private String responsibleOfficer;
    private String dueDate;
    private String status;
    private Long actId;
    private String actName;
    private String complianceControl;
    private String regulatoryRequirement;
    private String monitoringActivity;
    private String controlEffectivenessMeasure;
    private List<ControlPoint> points;
    private String controlType;
    private String residualLikelihood;
    private String residualImpact;
    private String residualRiskRating;
    private String ownerName;
    private Long obligationId;
    private String linkedObligationIds;
    private Instant createdAt;
}
