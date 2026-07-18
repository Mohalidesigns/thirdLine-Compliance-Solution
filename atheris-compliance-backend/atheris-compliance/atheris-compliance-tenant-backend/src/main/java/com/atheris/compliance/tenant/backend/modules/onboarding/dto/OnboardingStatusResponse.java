package com.atheris.compliance.tenant.backend.modules.onboarding.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data @Builder
public class OnboardingStatusResponse {
    private Boolean onboardingCompleted;
    private Integer currentStep;
    private Integer nextStep;
    private String legalName;
    private String licenceType;
    private String licenseStatus;
    private String authType;
    private List<Integer> subscribedRegulators;
    private List<String> subscribedDocumentTypes;
    private List<Integer> recommendedRegulators;
}
