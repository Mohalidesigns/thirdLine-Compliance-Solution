package com.atheris.compliance.intelligence.backend.modules.pipeline.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PipelineStatsDto {
    private long totalDownloads;
    private long successfulDownloads;
    private long failedDownloads;
    private long completed;
    private Map<String, Long> byRegulator;
    private Map<String, Long> byStage;
}
