package com.atheris.compliance.intelligence.backend.modules.licenses.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data @Builder
public class LicenseDto {
    private Integer id;
    private Long tenantId;
    private String legalName;
    private String licenseKey;
    private String tier;
    private Boolean intelligenceEnabled;
    private Integer maxUsers;
    private Integer maxDevices;
    private Integer maxRegulators;
    private Integer maxControls;
    private Integer maxReturns;
    private Integer maxStorageMb;
    private Boolean deviceFingerprintEnforced;
    private String status;
    private Instant activatedAt;
    private Instant expiresAt;
    private Integer gracePeriodDays;
    private Instant gracePeriodEnd;
    private Integer issuedBy;
    private String notes;
    private Integer deviceCount;
    private List<LicenseDeviceDto> devices;
    private Instant createdAt;
    private Instant updatedAt;
}
