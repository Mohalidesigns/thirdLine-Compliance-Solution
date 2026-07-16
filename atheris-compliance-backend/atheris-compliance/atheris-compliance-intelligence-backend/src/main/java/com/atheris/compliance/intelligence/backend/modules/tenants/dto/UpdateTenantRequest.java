package com.atheris.compliance.intelligence.backend.modules.tenants.dto;

import lombok.Data;
import java.util.List;

@Data
public class UpdateTenantRequest {
    private String legalName;
    private String webhookUrl;
    private String ccoEmail;
    private String techEmail;
    private List<Integer> regulators;
    private List<String> productLines;
    private List<String> subscribedDocumentTypes;
    private String notificationFrequency;
}
