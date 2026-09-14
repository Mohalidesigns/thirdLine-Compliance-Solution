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
    private String title;
    private String description;
    private String plainEnglishStatement;
    private String sectionReference;
    private String areaOfFocus;
    private String obligationType;
    private String riskRating;
    private String riskDescription;
    private String regulatorAbbreviation;
    private String actName;
    private String instrumentTitle;
    private Boolean hasPoints;
}
