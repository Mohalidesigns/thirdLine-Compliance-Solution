package com.atheris.platform.modules.tenants.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data @Builder
public class TenantDto {
    private Long tenantId;
    private String legalName;
    private String shortName;
    private String licenceType;
    private String licenceNumber;
    private List<Integer> regulators;
    private List<String> regulatorAbbreviations;
    private List<String> productLines;
    private List<String> subscribedDocumentTypes;
    private String notificationFrequency;
    private String ccoEmail;
    private String webhookUrl;
    private Boolean webhookEnabled;
    private String subscriptionTier;
    private Boolean isActive;
    private Instant onboardedAt;
}
