package com.atheris.tenant.modules.onboarding.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class RegulatorSubscriptionRequest {
    private List<Integer> subscribedRegulators;
    private String notificationFrequency;
    private List<Map<String, Object>> perRegulatorOverrides;
}
