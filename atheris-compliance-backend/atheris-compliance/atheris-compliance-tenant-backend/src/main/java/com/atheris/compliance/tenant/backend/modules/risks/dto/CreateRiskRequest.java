package com.atheris.compliance.tenant.backend.modules.risks.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data @Builder
public class CreateRiskRequest {

    private String name;
    private String description;
    private String riskType;
    private String areaOfFocus;
    private String inherentLikelihood;
    private String inherentImpact;

    @Builder.Default private List<Long> obligationIds = List.of();
    @Builder.Default private List<Integer> controlIds = List.of();
}