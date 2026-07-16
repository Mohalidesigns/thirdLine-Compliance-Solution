package com.atheris.compliance.intelligence.backend.modules.browser.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;

@Data @Builder
public class ObligationSummaryDto {
    private Long instrumentId;
    private String sourceTitle;
    private Integer regulatorId;
    private String regulatorAbbreviation;   // e.g. "CBN"
    private String areaOfFocus;
    private String nature;                  // Core | Secondary | Guidance
    private String riskRating;              // High | Medium | Low
    private Double applicabilityConfidence;
    private LocalDate dateIssued;
    private LocalDate dateCommencement;
    private String status;                  // Triage | Published | Superseded
    private String tenantClassification;    // applicable | not_applicable | under_review | unclassified
    private Boolean isWatching;             // Is this tenant watching this obligation?
    private Instant discoveredAt;
}
