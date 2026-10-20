package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data @Builder
public class ObligationStats {
    private long total;
    private long highRisk;
    private long withPoints;
    private long withoutPoints;
    private long gaps;
    /** Obligations that are linked to at least one return. */
    private long withReturns;
    private long underReview;
    private List<String> regulators;
    private List<String> themes;
    private List<String> owners;
    private List<String> riskLevels;
    /** Aliases consumed by the shared intel register config. */
    private List<String> risks;
    private List<String> areas;
    private List<String> acts;
}
