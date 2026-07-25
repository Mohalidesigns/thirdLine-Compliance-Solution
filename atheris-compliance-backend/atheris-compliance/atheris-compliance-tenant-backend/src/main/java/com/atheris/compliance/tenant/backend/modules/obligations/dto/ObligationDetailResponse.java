package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class ObligationDetailResponse {
    private Long instrumentId;
    private String sourceTitle;
    private String regulatorAbbreviation;
    private String regulatorName;
    private String documentType;
    private String platformRiskRating;
    private String aiSummary;
    private LocalDate dateIssued;
    private LocalDate effectiveDate;
    private LocalDate publishedAt;
    private String pdfUrl;
    private String applicability;
    private String applicabilityReasoning;
    private String tenantRiskRating;
    private String riskJustification;
    private String riskType;
    private String impactRating;
    private String impactJustification;
    private String likelihoodRating;
    private String likelihoodJustification;
    private String inherentRiskRating;
    private String residualRiskRating;
    private Integer assignedOwnerUserId;
    private String assignedOwnerName;
    private String assignedDepartment;
    private List<Integer> linkedControlIds;
    private Boolean hasGap;
    private String gapDescription;
    private String status;
    private Integer classificationVersion;
    private Integer classifiedByUserId;
    private Instant classifiedAt;
    private Instant updatedAt;
    private List<ObligationItem> obligations;
    private List<HistoryItem> history;

    @Data @Builder
    public static class ObligationItem {
        private Long obligationId;
        private Integer obligationNumber;
        private String description;
        private String sectionReference;
        private String obligationType;
        private LocalDate effectiveDate;
        private String status;
    }

    @Data @Builder
    public static class HistoryItem {
        private Integer classificationVersion;
        private String applicability;
        private String tenantRiskRating;
        private Integer assignedOwnerUserId;
        private Boolean hasGap;
        private String changeReason;
        private Integer changedByUserId;
        private Instant changedAt;
    }
}
