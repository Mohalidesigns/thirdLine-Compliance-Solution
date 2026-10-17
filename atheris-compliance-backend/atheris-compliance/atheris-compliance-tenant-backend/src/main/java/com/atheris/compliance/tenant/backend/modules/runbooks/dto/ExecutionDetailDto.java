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
public class ExecutionDetailDto {
    private Long executionId;
    private String executionRef;
    private Long runbookId;
    private String runbookCode;
    private String runbookTitle;
    private String criticality;
    private Long versionId;
    private Integer versionNumber;
    private String triggerType;
    private Long triggerRefId;
    private Integer operatorUserId;
    private String operatorName;
    private String status;
    private String outcome;
    private Instant startedAt;
    private Instant dueAt;
    private Instant completedAt;
    private Instant closedAt;
    private Integer stepsTotal;
    private Integer stepsPassed;
    private Integer stepsFailed;
    private Integer stepsSkipped;
    private Integer evidenceCount;
    private Integer slaMinutes;
    private Boolean overdue;
    private Long findingId;
    private Instant createdAt;
    private String outcomeSummary;
    private Instant preflightCompletedAt;
    @Builder.Default
    private List<PrereqStatus> prerequisites = new ArrayList<>();
    @Builder.Default
    private List<StepExecutionDto> steps = new ArrayList<>();
    @Builder.Default
    private List<EscalationRecord> escalations = new ArrayList<>();
    @Builder.Default
    private List<SignoffDto> signoffs = new ArrayList<>();
    @Builder.Default
    private List<Milestone> milestones = new ArrayList<>();
    private Instant sla50At;
    private Instant sla80At;
    private Integer evidenceCompleteness;
    private Integer mandatoryEvidenceMissing;
    @Builder.Default
    private List<ClauseDto> clauses = new ArrayList<>();
    private Boolean packAvailable;
    private String packHash;
    private Long packFileId;
    private Instant packGeneratedAt;
    @Builder.Default
    private List<Long> linkedControlIds = new ArrayList<>();

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PrereqStatus {
        private Long prereqId;
        private String prereqType;
        private String label;
        private String detail;
        private Boolean mandatory;
        private Boolean acknowledged;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EscalationRecord {
        private Long execEscId;
        private Integer level;
        private String triggerType;
        private String notifiedRole;
        private Integer notifiedUserId;
        private String notifiedName;
        private String channel;
        private Instant sentAt;
        private Instant acknowledgedAt;
        private String acknowledgedByName;
        private String notes;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SignoffDto {
        private Long signoffId;
        private String signoffRole;
        private Integer userId;
        private String userName;
        private String decision;
        private String comment;
        private Instant signedAt;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Milestone {
        private String label;
        private Instant dueAt;
        private Integer slaMinutes;
        private String clauseRef;
        private String frameworkCode;
    }
}
