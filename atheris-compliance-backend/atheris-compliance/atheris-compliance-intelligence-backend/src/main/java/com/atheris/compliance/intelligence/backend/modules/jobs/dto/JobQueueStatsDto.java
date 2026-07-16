package com.atheris.compliance.intelligence.backend.modules.jobs.dto;

import lombok.Builder;
import lombok.Data;
import java.util.Map;

@Data @Builder
public class JobQueueStatsDto {
    private long totalPending;
    private long totalProcessing;
    private long totalCompleted;
    private long totalFailed;
    private Map<String, Map<String, Long>> perType;
}
