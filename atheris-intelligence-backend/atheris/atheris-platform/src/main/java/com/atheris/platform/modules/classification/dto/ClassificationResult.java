package com.atheris.platform.modules.classification.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class ClassificationResult {
    @JsonProperty("area_of_focus") private String areaOfFocus;
    private String nature;
    @JsonProperty("risk_rating") private String riskRating;
    @JsonProperty("licence_types_applicable") private List<String> licenceTypesApplicable;
    @JsonProperty("applicability_confidence") private Double applicabilityConfidence;
    @JsonProperty("ai_summary") private String aiSummary;
    private List<ObligationItem> obligations;

    @Data
    public static class ObligationItem {
        private Integer number;
        private String statement;
        @JsonProperty("section_reference") private String sectionReference;
        private String type;
        @JsonProperty("recurring_deadline") private String recurringDeadline;
    }
}
