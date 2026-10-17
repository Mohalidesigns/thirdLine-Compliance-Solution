package com.atheris.compliance.intelligence.backend.modules.pipeline.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PipelineItemDto {
    private String id;
    private String type;
    private Long instrumentId;
    private Long pendingId;
    private String title;
    private String reference;
    private Integer regulatorId;
    private String regulatorAbbreviation;
    private String stage;
    private String status;
    private Instant discoveredAt;
    private String errorMessage;
}
