package com.atheris.tenant.modules.license.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ActivateLicenseRequest {
    @NotBlank
    private String licenseKey;
    private String deviceFingerprint;
    private String deviceLabel;
}
