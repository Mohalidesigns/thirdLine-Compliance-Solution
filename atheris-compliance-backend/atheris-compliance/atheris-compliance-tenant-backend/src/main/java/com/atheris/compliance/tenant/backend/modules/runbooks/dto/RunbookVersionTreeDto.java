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
public class RunbookVersionTreeDto {
    private Long versionId;
    private Long runbookId;
    private Integer versionNumber;
    private String status;
    private String changeSummary;
    private String contentHash;
    private Integer authoredByUserId;
    private String authoredByName;
    private String approvedByName;
    private Instant approvedAt;
    private Instant publishedAt;
    private Instant submittedAt;
    private Instant createdAt;
    @Builder.Default
    private List<PrerequisiteDto> prerequisites = new ArrayList<>();
    @Builder.Default
    private List<SectionDto> sections = new ArrayList<>();
    @Builder.Default
    private List<EscalationDto> escalations = new ArrayList<>();
    @Builder.Default
    private List<RollbackStepDto> rollbackSteps = new ArrayList<>();
    @Builder.Default
    private List<ApprovalDto> approvals = new ArrayList<>();
}
