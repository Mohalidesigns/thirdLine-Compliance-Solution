package com.atheris.compliance.intelligence.backend.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data @Builder
public class AdminObligationDetailDto {
    private Long obligationId;
    private Integer obligationNumber;
    private String title;
    private String description;
    private String plainEnglishStatement;
    private String specificSectionReference;
    private String areaOfFocus;
    private String obligationType;
    private String recurringDeadlineType;
    private Integer complianceDeadlineDays;
    private String riskDescription;
    private String inherentLikelihood;
    private String inherentImpact;
    private String inherentRiskRating;
    private String controlOwner;
    private Instant createdAt;
    private Long regulationId;
    private String actName;
    private String actAbbreviation;
    private Long instrumentId;
}
