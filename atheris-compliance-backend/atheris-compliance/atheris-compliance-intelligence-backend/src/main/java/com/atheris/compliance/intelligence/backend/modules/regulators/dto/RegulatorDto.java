package com.atheris.compliance.intelligence.backend.modules.regulators.dto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class RegulatorDto {
    private Integer regulatorId;
    private String name;
    private String abbreviation;
    private String websiteUrl;
    private String publicationPageUrl;
    private String scraperStrategy;
    private String scraperFrequency;
    private String pdfLinkSelector;
    private Boolean paginationEnabled;
    private String paginationStrategy;
    private Integer maxPagesPerRun;
    private Integer maxPdfSizeMb;
    private Boolean scraperEnabled;
    private Boolean isActive;
    private Instant scraperLastRanAt;
    private Integer scraperLastFound;
    private Integer scraperConsecutiveFailures;
    private String scraperDisabledReason;
    private String scraperNotes;
    private Integer instrumentCount;
    private Integer pendingDownloadCount;
    private Instant lastInstrumentDiscoveredAt;
    private Long obligationCount;
}
