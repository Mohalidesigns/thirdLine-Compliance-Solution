package com.atheris.compliance.tenant.backend.modules.requirements.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data @JsonIgnoreProperties(ignoreUnknown = true)
public class RequirementRequest {
    private Long obligationId;
    private String text;
    private Integer riskId;
    private List<Integer> controlIds;
}
