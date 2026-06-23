package com.atheris.platform.modules.tenants.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class WebhookTestResult {
    private Boolean delivered;
    private Integer statusCode;
    private Integer latencyMs;
    private String error;
}
