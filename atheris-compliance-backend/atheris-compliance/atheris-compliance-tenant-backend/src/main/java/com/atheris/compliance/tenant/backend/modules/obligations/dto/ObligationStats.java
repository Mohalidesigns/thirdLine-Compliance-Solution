package com.atheris.compliance.tenant.backend.modules.obligations.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data @Builder
public class ObligationStats {
    private long total;
    private long highRisk;
    private long gaps;
    private long underReview;
    private List<String> regulators;
    private List<String> themes;
    private List<String> owners;
    private List<String> riskLevels;
}
