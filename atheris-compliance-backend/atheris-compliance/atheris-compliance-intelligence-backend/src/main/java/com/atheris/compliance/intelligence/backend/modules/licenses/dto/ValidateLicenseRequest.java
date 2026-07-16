package com.atheris.compliance.intelligence.backend.modules.licenses.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ValidateLicenseRequest {
    @NotBlank
    private String licenseKey;
    private String deviceFingerprint;
    private String deviceLabel;
    private String ipAddress;
}
