package com.atheris.compliance.tenant.backend.modules.settings.dto;

import lombok.Data;

@Data
public class ComplianceSettingsRequest {
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
