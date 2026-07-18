package com.atheris.compliance.tenant.backend.shared.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class IngestResponseDto {
    private Long instrumentId;
    private Long jobId;
    private String status;
    private boolean duplicate;
    private String message;
    private String error;
}
