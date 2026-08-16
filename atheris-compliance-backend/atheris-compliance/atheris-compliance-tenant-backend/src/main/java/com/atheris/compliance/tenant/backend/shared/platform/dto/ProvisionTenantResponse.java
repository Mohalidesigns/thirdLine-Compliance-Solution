package com.atheris.compliance.tenant.backend.shared.platform.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class ProvisionTenantResponse {
    private Long tenantId;
    private String webhookSecret;
    private String apiKey;
    private String message;
}
