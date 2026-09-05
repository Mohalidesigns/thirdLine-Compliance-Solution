package com.atheris.compliance.intelligence.backend.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class AdminObligationDto {
    private Long obligationId;
    private Integer obligationNumber;
    private String title;
    private String description;
    private String plainEnglishStatement;
    private String specificSectionReference;
    private String areaOfFocus;
    private String obligationType;
    private String recurringDeadlineType;
    private String inherentRiskRating;
    private String inherentLikelihood;
    private String inherentImpact;
    private Long regulationId;
    private String actName;
    private Long instrumentId;
}
