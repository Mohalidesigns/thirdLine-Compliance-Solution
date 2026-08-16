package com.atheris.compliance.intelligence.backend.modules.tenants.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ProvisionTenantRequest {
    @NotBlank private String licenseKey;
}
