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
public class RunbookDetailDto {
    private Long runbookId;
    private String runbookCode;
    private String title;
    private String category;
    private String criticality;
    private String frequency;
    private String status;
    private String statusReason;
    private Integer ownerUserId;
    private String ownerName;
    private Integer slaMinutes;
    private Integer currentVersionNumber;
    private Long currentVersionId;
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
    private Integer sourceTemplateVersion;
    private Boolean templateUpdateAvailable;
    private Integer latestTemplateVersion;
    private String objective;
    @Builder.Default
    private List<String> scopeSystems = new ArrayList<>();
    @Builder.Default
    private List<String> scopeTeams = new ArrayList<>();
    @Builder.Default
    private List<String> tags = new ArrayList<>();
    private String reviewCadence;
    @Builder.Default
    private List<Long> linkedObligationIds = new ArrayList<>();
    @Builder.Default
    private List<Long> linkedControlIds = new ArrayList<>();
    @Builder.Default
    private List<LinkedObligation> linkedObligations = new ArrayList<>();
    @Builder.Default
    private List<LinkedControl> linkedControls = new ArrayList<>();
    @Builder.Default
    private List<ClauseDto> clauses = new ArrayList<>();
    private RunbookVersionTreeDto currentVersion;
    @Builder.Default
    private List<ScheduleDto> schedules = new ArrayList<>();
    @Builder.Default
    private List<ExecutionSummaryDto> recentExecutions = new ArrayList<>();
    private Instant createdAt;
    private Instant updatedAt;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LinkedObligation {
        private Long obligationId;
        private String title;
        private String sectionReference;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LinkedControl {
        private Integer controlId;
        private String controlNumber;
        private String name;
    }
}
