package com.atheris.compliance.tenant.backend.modules.onboarding.dto;

import lombok.Data;

@Data
public class OnboardingConfirmRequest {
    private String webhookUrl;
}
