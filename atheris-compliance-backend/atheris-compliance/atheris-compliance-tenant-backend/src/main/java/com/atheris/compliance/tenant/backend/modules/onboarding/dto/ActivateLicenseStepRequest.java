package com.atheris.compliance.tenant.backend.modules.onboarding.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ActivateLicenseStepRequest {
    @NotBlank
    private String licenseKey;
    private String deviceFingerprint;
    private String deviceLabel;
}
