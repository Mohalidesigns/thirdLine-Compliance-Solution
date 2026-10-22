package com.atheris.compliance.tenant.backend.modules.tasks.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskStatsDto {
    private long total;
    private long overdue;
    private long dueToday;
    private long dueThisWeek;
    private long unassigned;
    private long completedLast7d;
    @Builder.Default
    private Map<String, Long> byCategory = Map.of();
    @Builder.Default
    private Map<String, Long> byPriority = Map.of();
}
