package com.atheris.compliance.tenant.backend.modules.controls.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data @Builder
public class ControlRegisterItem {
    private Integer controlId;
    private String controlNumber;
    private String name;
    private String theme;
    private String controlOwnerName;
    private String ownerName;
    private String controlType;
    private String residualRisk;
    private String residualLikelihood;
    private String residualImpact;
    private String residualRiskRating;
    private String status;
    private LocalDate nextTestDueDate;
    private String complianceArea;
    private String regulatoryRequirement;
    private String frequency;
    private String dueDate;
    private Integer actId;
    private String actName;
}
