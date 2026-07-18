package com.atheris.compliance.tenant.backend.modules.subscriptions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class UploadJobResponse {
    private UUID uploadId;
    private String status;
    private Long platformInstrumentId;
    private String errorMessage;
}
