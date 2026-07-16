package com.atheris.compliance.intelligence.backend.modules.tenants.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.List;

@Data
public class CreateTenantRequest {
    @NotBlank private String legalName;
    private String shortName;
    @NotBlank private String licenceType;
    private String licenceNumber;
    private List<Integer> regulators;
    private List<String> productLines;
    private List<String> subscribedDocumentTypes;
    private String notificationFrequency;
    private String ccoName;
    private String ccoEmail;
    private String techEmail;
    private String webhookUrl;
    private String subscriptionTier;
}
