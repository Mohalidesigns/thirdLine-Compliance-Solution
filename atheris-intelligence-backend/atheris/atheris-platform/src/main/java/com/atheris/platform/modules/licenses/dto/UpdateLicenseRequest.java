package com.atheris.platform.modules.licenses.dto;

import jakarta.validation.constraints.Positive;
import lombok.Data;
import java.time.Instant;

@Data
public class UpdateLicenseRequest {
    private String tier;
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
    private Instant expiresAt;
    @Positive
    private Integer gracePeriodDays;
    private String notes;
}
