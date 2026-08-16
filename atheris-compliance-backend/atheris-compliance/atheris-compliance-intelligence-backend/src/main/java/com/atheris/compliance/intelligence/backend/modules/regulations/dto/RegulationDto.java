package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class RegulationDto {
    private Long regulationId;
    private String name;
    private String abbreviation;
    private String description;
    private Integer regulatorId;
    private String regulatorName;
    private String status;
    private long instrumentCount;
    private long obligationCount;
    private long sanctionCount;
    private long returnCount;
}