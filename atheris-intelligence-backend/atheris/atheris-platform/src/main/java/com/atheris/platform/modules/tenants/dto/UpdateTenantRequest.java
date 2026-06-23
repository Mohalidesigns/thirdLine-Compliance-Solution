package com.atheris.platform.modules.tenants.dto;

import lombok.Data;
import java.util.List;

@Data
public class UpdateTenantRequest {
    private String legalName;
    private String webhookUrl;
    private String ccoEmail;
    private String techEmail;
    private List<String> regulators;
    private List<String> productLines;
    private List<String> subscribedDocumentTypes;
    private String notificationFrequency;
}
