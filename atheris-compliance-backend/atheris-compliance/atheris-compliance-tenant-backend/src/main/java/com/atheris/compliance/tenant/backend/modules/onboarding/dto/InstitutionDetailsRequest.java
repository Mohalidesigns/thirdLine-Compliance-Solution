package com.atheris.compliance.tenant.backend.modules.onboarding.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class InstitutionDetailsRequest {
    @NotBlank private String legalName;
    private String address;
    private String contactPhone;
    private String contactEmail;
    private String ccoEmail;
}
