package com.atheris.platform.modules.tenants.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class CreateTenantResponse {
    private String tenantId;
    private String webhookSecret;    // Shown ONCE — tenant must save this
    private String apiKey;
    private String message;
}
