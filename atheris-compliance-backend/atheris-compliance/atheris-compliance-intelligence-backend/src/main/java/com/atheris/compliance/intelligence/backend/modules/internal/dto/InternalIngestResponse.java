package com.atheris.compliance.intelligence.backend.modules.internal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class InternalIngestResponse {
    private Long instrumentId;
    private Long jobId;
    private String status;
    private boolean duplicate;
    private String message;
}
