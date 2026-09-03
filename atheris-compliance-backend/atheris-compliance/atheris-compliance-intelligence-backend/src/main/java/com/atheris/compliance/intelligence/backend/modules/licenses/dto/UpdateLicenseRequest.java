package com.atheris.compliance.intelligence.backend.modules.licenses.dto;

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
    private Integer maxStorageMb;
    private Boolean deviceFingerprintEnforced;
    private Boolean autoSubscribeRegulators;
    private Boolean autoSeedObligations;
    private Instant expiresAt;
    @Positive
    private Integer gracePeriodDays;
    private String notes;
}
