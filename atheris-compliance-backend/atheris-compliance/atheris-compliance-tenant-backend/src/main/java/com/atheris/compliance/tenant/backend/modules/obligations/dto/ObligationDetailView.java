package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data @Builder
public class ObligationDetailView {
    private Long obligationId;
    private Integer obligationNumber;
    private String name;
    private String description;
    private String sectionReference;
    private String areaOfFocus;
    private String obligationType;
    private String recurringDeadlineType;

    private Long instrumentId;
    private String sourceTitle;
    private String regulatorAbbreviation;
    private String regulatorName;
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
    private Integer assignedOwnerId;
    private Integer assignedTeamId;
    private Integer assignedDepartmentId;
    private String assignedOwnerName;
    private String assignedDepartment;
    private Boolean hasGap;
    private String gapDescription;
    private String status;
    private Integer classificationVersion;
    private Instant classifiedAt;
    private String classifiedByName;

    private List<ControlItem> linkedControls;
    private List<ReturnItem> linkedReturns;
    private List<EvidenceItem> evidence;
    private List<HistoryItem> history;
    private List<SanctionItem> sanctions;

    @Data @Builder
    public static class SanctionItem {
        private String sanctionType;
        private BigDecimal sanctionAmountNaira;
        private Boolean sanctionAmountPerDay;
        private List<String> liableRoles;
        private Integer severityScore;
        private Boolean hasBeenEnforced;
        private String description;
        private String sourceSectionReference;
        private String riskExplanation;
        private String penaltyDetails;
    }

    @Data @Builder
    public static class ControlItem {
        private Integer controlId;
        private String controlNumber;
        private String name;
        private String theme;
        private String controlType;
        private String inherentRisk;
        private String residualRisk;
        private String controlOwnerName;
        private String status;
    }

    @Data @Builder
    public static class ReturnItem {
        private Long returnId;
        private String returnName;
        private String frequency;
        private String filingRegulator;
    }

    @Data @Builder
    public static class EvidenceItem {
        private Long fileId;
        private String originalName;
        private String mimeType;
        private Long fileSize;
        private String description;
        private Integer uploadedByUserId;
        private String uploadedByName;
        private Instant createdAt;
        private String downloadUrl;
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
        private String changedByName;
        private Instant changedAt;
    }
}
