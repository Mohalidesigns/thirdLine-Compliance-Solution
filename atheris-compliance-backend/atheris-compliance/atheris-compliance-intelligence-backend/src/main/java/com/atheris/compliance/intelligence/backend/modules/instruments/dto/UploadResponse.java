package com.atheris.compliance.intelligence.backend.modules.instruments.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class UploadResponse {
    private Long instrumentId;
    private String status;
    private String extractedTextPreview;
    private Integer textLength;
    private Long jobId;
    private String message;
    private boolean duplicate;
}
