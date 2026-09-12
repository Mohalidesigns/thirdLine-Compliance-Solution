package com.atheris.compliance.intelligence.backend.modules.obligations.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ObligationExplorerDetail {
    private Long obligationId;
    private String title;
    private String description;
    private String plainEnglishStatement;
    private String sectionReference;
    private String areaOfFocus;
    private String obligationType;
    private String recurringDeadlineType;
    private Integer complianceDeadlineDays;
    private String riskRating;
    private String riskDescription;
    private String inherentLikelihood;
    private String inherentImpact;
    private String controlOwner;
    private String regulatorAbbreviation;
    private String regulatorName;
    private Integer regulatorId;
    private String actName;
    private Long actId;
    private String instrumentTitle;
    private Long instrumentId;
    private Boolean hasPoints;
    @Builder.Default
    private List<Map<String, Object>> points = List.of();
    private Instant createdAt;
    private InstrumentInfo instrument;
    @Builder.Default
    private List<SanctionInfo> sanctions = List.of();
    @Builder.Default
    private List<ReturnInfo> returns = List.of();

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InstrumentInfo {
        private Long instrumentId;
        private String sourceTitle;
        private Integer regulatorId;
        private String regulatorAbbreviation;
        private String regulatorName;
        private Long regulationId;
        private String actName;
        private String areaOfFocus;
        private String nature;
        private String riskRating;
        private String riskRatingExplanation;
        private String regulatoryItemType;
        private LocalDate dateIssued;
        private LocalDate dateCommencement;
        private String status;
        private String documentUrl;
        private String pdfUrl;
        private String aiSummary;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SanctionInfo {
        private Long sanctionId;
        private String sanctionType;
        private BigDecimal sanctionAmountNaira;
        private Boolean sanctionAmountPerDay;
        private List<String> liableRoles;
        private String description;
        private String sectionReference;
        private String riskExplanation;
        private String penaltyDetails;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReturnInfo {
        private Long returnId;
        private String title;
        private String sectionReference;
        private String statutoryBasis;
        private String responsibleUnit;
        private String responsiblePerson;
        private String frequency;
        private String deadline;
    }
}
