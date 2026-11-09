package com.atheris.compliance.intelligence.backend.modules.classification.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClassificationResult {
    @JsonProperty("area_of_focus") private String areaOfFocus;
    private String nature;
    @JsonProperty("risk_rating") private String riskRating;
    @JsonProperty("risk_rating_explanation") private String riskRatingExplanation;
    @JsonProperty("regulatory_item_type") private String regulatoryItemType;
    @JsonProperty("applicability_to_commercial_banks") private String applicabilityToCommercialBanks;
    @JsonProperty("act_name") private String actName;
    @JsonProperty("date_of_issue") private String dateOfIssue;
    @JsonProperty("date_of_commencement") private String dateOfCommencement;
    @JsonProperty("licence_types_applicable") private List<String> licenceTypesApplicable;
    @JsonProperty("applicability_confidence") private Double applicabilityConfidence;
    @JsonProperty("ai_summary") private String aiSummary;
    @JsonProperty("reference_number") private String referenceNumber;
    private String regulator;
    @Builder.Default
    private List<ObligationItem> obligations = List.of();
    @Builder.Default
    private List<SanctionItem> sanctions = List.of();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ObligationItem {
        private Integer number;
        // interpreted plain English single enforceable sentence <=250 chars
        private String statement;
        // verbatim excerpt <=500 chars
        private String description;
        private String title;
        @JsonProperty("section_reference") private String sectionReference;
        private String type;
        @JsonProperty("recurring_deadline") private String recurringDeadline;
        @JsonProperty("area_of_focus") private String areaOfFocus;
        @JsonProperty("risk_description") private String riskDescription;
        private String likelihood;
        private String impact;
        @JsonProperty("control_owner") private String controlOwner;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SanctionItem {
        private String description;
        @JsonProperty("section_reference") private String sectionReference;
        @JsonProperty("source_section_reference") private String sourceSectionReference;
        @JsonProperty("penalty_details") private String penaltyDetails;
        @JsonProperty("risk_explanation") private String riskExplanation;
        @JsonProperty("sanction_amount") private String sanctionAmount;
        @JsonProperty("liable_roles") private List<String> liableRoles;
        @JsonProperty("sanction_type") private String sanctionType;
    }
}
