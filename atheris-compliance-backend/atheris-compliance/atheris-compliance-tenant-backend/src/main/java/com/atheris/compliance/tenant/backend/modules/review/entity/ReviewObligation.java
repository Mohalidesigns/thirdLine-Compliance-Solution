package com.atheris.compliance.tenant.backend.modules.review.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewObligation {
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
}
