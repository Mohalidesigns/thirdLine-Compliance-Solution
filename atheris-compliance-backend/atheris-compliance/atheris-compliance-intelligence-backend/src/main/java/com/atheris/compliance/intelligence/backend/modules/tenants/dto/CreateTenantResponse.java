package com.atheris.compliance.intelligence.backend.modules.tenants.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class CreateTenantResponse {
    private Long tenantId;
    private String webhookSecret;    // Shown ONCE — tenant must save this
    private String apiKey;
    private String message;
}
