package com.atheris.compliance.tenant.backend.modules.runbooks.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RunbookSummaryDto {
    private Long runbookId;
    private String runbookCode;
    private String title;
    private String category;
    private String criticality;
    private String frequency;
    private String status;
    private Integer ownerUserId;
    private String ownerName;
    private Integer slaMinutes;
    private Integer currentVersionNumber;
    private Long draftVersionId;
    private String draftVersionStatus;
    private Integer clauseCount;
    @Builder.Default
    private List<String> frameworkCodes = new ArrayList<>();
    private Integer linkedObligationCount;
    private Integer linkedControlCount;
    private String lastExecutionStatus;
    private Instant lastExecutionAt;
    private LocalDate nextRunAt;
    private LocalDate nextReviewAt;
    private Boolean needsReview;
    private String sourceTemplateCode;
    private Instant updatedAt;
}
