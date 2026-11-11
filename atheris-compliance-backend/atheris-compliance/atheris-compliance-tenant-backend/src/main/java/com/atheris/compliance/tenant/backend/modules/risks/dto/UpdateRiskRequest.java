package com.atheris.compliance.tenant.backend.modules.risks.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data @Builder
public class UpdateRiskRequest {

    private String name;
    private String description;
    private String riskType;
    private String areaOfFocus;
    private String status;
    private String inherentLikelihood;
    private String inherentImpact;

    private List<Long> obligationIds;
    private List<Integer> controlIds;
}