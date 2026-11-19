package com.atheris.compliance.tenant.backend.modules.settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ComplianceSettingsResponse {
    private Integer residualAllDrop;
    private Integer residualMajorityDrop;
    private String residualAxis;
    private String residualTarget;
    private Integer residualFloor;

    private Integer controlDueSoonDays;
    private Integer findingDueSoonDays;

    private Integer slaCriticalDays;
    private Integer slaHighDays;
    private Integer slaMediumDays;
    private Integer slaLowDays;

    private Boolean requireControlTestReview;
    private Boolean requireFindingReview;
}
