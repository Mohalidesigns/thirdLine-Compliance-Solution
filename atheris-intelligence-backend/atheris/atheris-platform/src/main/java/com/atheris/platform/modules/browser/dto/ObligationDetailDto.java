package com.atheris.platform.modules.browser.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class ObligationDetailDto {
    private Long instrumentId;
    private String sourceTitle;
    private Integer regulatorId;
    private String regulatorAbbreviation;
    private String instrumentType;
    private String areaOfFocus;
    private String nature;
    private String riskRating;
    private Double applicabilityConfidence;
    private String applicabilityNotes;
    private String aiSummary;
    private List<String> licenceTypesApplicable;
    private LocalDate dateIssued;
    private LocalDate dateCommencement;
    private String status;
    private String pdfUrl;
    private String sourceUrl;
    private Instant discoveredAt;

    // Tenant-specific (null if not authenticated or no decision made)
    private String tenantClassification;    // applicable | not_applicable | under_review | unclassified
    private Boolean isWatching;

    // Specific duties extracted by AI
    private List<ObligationItem> obligations;

    // Sanctions and penalties
    private List<SanctionItem> sanctions;

    @Data @Builder
    public static class ObligationItem {
        private Integer number;
        private String statement;
        private String sectionReference;
        private String type;               // Operational | Reporting | Governance | One-time
        private String recurringDeadline;  // Continuous | Monthly | Quarterly | Annual
    }

    @Data @Builder
    public static class SanctionItem {
        private String sanctionType;
        private BigDecimal amountNaira;
        private Boolean perIncident;
        private List<String> liableRoles;
        private Integer severityScore;
        private Boolean hasBeenEnforced;
        private java.time.LocalDate recentEnforcementDate;
    }
}
