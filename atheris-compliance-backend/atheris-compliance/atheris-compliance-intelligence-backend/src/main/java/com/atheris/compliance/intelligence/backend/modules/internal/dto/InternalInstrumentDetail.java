package com.atheris.compliance.intelligence.backend.modules.internal.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class InternalInstrumentDetail {
    private Long instrumentId;
    private String sourceTitle;
    private String sourceReferenceNumber;
    private Integer regulatorId;
    private String regulatorName;
    private String regulatorAbbreviation;
    private LocalDate dateIssued;
    private LocalDate dateCommencement;
    private String riskRating;
    private String nature;
    private String areaOfFocus;
    private String aiSummary;
    private String pdfUrl;
    private String pdfOcrText;
    private LocalDate publishedAt;
    private String status;
    private List<ObligationItem> obligations;
    private List<SanctionItem> sanctions;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ObligationItem {
        private Integer obligationNumber;
        private String title;
        private String description;
        private String plainEnglishStatement;
        private String specificSectionReference;
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
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SanctionItem {
        private String sanctionType;
        private BigDecimal amountNaira;
        private Boolean sanctionAmountPerDay;
        private List<String> liableRoles;
        private Integer severityScore;
        private Boolean hasBeenEnforced;
        private String description;
        private String sourceSectionReference;
        private String riskExplanation;
        private String penaltyDetails;
        private Long regulationId;
        private String actName;
    }
}
