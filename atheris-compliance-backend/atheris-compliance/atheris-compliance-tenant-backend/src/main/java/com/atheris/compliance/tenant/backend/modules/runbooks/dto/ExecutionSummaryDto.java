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
public class ExecutionSummaryDto {
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
}
