package com.atheris.compliance.tenant.backend.modules.review.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;

@Data @Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewDetail {
    private Long reviewId;
    private String source;
    private Long instrumentId;
    private String uploadId;
    private String sourceTitle;
    private String sourceReferenceNumber;
    private Integer regulatorId;
    private String regulatorAbbreviation;
    private String regulatorName;
    private String documentType;
    private String riskRating;
    private LocalDate dateIssued;
    private LocalDate effectiveDate;
    private LocalDate publishedAt;
    private String pdfUrl;
    private String aiSummary;
    private String pdfOcrText;
    private String status;
    private Instant createdAt;
    @Builder.Default private List<ReviewObligationDto> obligations = List.of();
    @Builder.Default private List<ReviewSanctionDto> sanctions = List.of();

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReviewObligationDto {
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

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReviewSanctionDto {
        private String sanctionType;
        private BigDecimal amountNaira;
        @Builder.Default private Boolean sanctionAmountPerDay = false;
        private List<String> liableRoles;
        private Integer severityScore;
        @Builder.Default private Boolean hasBeenEnforced = false;
        private String description;
        private String sourceSectionReference;
        private String riskExplanation;
        private String penaltyDetails;
        private Long regulationId;
        private String actName;
    }
}
