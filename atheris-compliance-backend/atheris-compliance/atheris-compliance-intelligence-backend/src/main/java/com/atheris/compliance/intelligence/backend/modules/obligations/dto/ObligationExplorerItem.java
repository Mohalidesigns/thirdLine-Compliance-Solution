package com.atheris.compliance.intelligence.backend.modules.obligations.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ObligationExplorerItem {
    private Long obligationId;
    private Integer obligationNumber;
    private String title;
    private String description;
    private String plainEnglishStatement;
    private String sectionReference;
    private String areaOfFocus;
    private String obligationType;
    private String recurringDeadlineType;
    private String riskRating;
    private String inherentLikelihood;
    private String inherentImpact;
    private String riskDescription;
    private Integer regulatorId;
    private String regulatorAbbreviation;
    private Long actId;
    private String actName;
    private Long instrumentId;
    private String instrumentTitle;
    private Boolean hasPoints;
}
