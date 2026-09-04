package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InstrumentDetailResponse {
    private Long id;
    private String sourceTitle;
    private String title;
    private String regulatorAbbreviation;
    private String regulatorName;
    private String documentType;
    private String riskRating;
    private String status;
    private LocalDate publishedAt;
    private String pdfUrl;
    private String aiSummary;
    private String pdfOcrText;
    private List<ObligationItem> obligations;
    private List<SanctionItem> sanctions;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ObligationItem {
        private Long obligationId;
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
        private LocalDate effectiveDate;
        private String status;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SanctionItem {
        private Long sanctionId;
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
