package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InboxItemResponse {
    private Long instrumentId;
    private Long obligationId;
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
    private String status;
    private int obligationCount;
    private String penaltySummary;
    private String pdfOcrText;

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
    private Integer classificationVersion;
    private Instant classifiedAt;
    private Instant updatedAt;
}
