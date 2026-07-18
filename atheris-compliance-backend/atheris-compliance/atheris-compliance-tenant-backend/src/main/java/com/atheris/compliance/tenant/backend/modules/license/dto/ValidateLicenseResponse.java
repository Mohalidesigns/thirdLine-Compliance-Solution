package com.atheris.compliance.tenant.backend.modules.license.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class ValidateLicenseResponse {
    private boolean valid;
    private String status;
    private String tier;
    private Boolean intelligenceEnabled;
    private Integer maxUsers;
    private Integer maxDevices;
    private Instant expiresAt;
    private Instant gracePeriodEnd;
    private Integer gracePeriodDays;
    private Boolean deviceRegistered;
    private Integer deviceCount;
    private Integer deviceLimit;
    private String apiKey;
    private String message;
}
