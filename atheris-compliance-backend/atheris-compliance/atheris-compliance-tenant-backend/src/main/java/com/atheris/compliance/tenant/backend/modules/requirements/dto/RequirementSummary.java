package com.atheris.compliance.tenant.backend.modules.requirements.dto;

import lombok.Builder;
import lombok.Data;

/** Requirement coverage of one obligation, for the register row. */
@Data @Builder
public class RequirementSummary {
    private Long obligationId;
    private int requirementCount;
    private int coveredCount;
    private int gapCount;
    private String state;
    private boolean hasGap;
}
