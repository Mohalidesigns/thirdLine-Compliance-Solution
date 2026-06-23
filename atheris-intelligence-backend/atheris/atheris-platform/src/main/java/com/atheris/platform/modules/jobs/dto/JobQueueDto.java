package com.atheris.platform.modules.jobs.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.Map;

@Data @Builder
public class JobQueueDto {
    private Long jobId;
    private String jobType;
    private Long subjectId;
    private String status;
    private Integer priority;
    private Integer attemptCount;
    private Integer maxAttempts;
    private String lastError;
    private Instant nextRetryAt;
    private Instant startedAt;
    private Instant completedAt;
    private String createdByService;
    private Instant createdAt;
    private Instant updatedAt;
    private Map<String, Object> payload;
}
