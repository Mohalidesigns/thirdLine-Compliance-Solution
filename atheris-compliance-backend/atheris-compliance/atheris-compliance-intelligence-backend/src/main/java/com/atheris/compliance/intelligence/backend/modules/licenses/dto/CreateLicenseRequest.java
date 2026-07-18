package com.atheris.compliance.intelligence.backend.modules.licenses.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import java.time.Instant;

@Data
public class CreateLicenseRequest {
    private Long tenantId;
    @NotBlank
    private String tier;
    @NotNull
    private Boolean intelligenceEnabled;
    @Positive
    private Integer maxUsers;
    @Positive
    private Integer maxDevices;
    @Positive
    private Integer maxRegulators;
    @Positive
    private Integer maxControls;
    @Positive
    private Integer maxReturns;
    @Positive
    private Integer maxStorageMb;
    private Boolean deviceFingerprintEnforced;
    @NotNull
    private Instant expiresAt;
    @Positive
    private Integer gracePeriodDays;
    private String notes;
}
