package com.atheris.compliance.intelligence.backend.modules.regulations.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Act detail header + coverage counts. The per-section rows are served by the existing
 * register endpoints filtered by act ({@code /admin/{instruments|obligations|sanctions|returns|controls}}),
 * so this DTO carries no child rows.
 */
@Data @Builder
public class RegulationDetailDto {
    private Long regulationId;
    private String name;
    private String abbreviation;
    private String description;
    private Integer regulatorId;
    private String regulatorName;
    private String status;
    private int instrumentCount;
    private int obligationCount;
    private int sanctionCount;
    private int returnCount;
    private int controlCount;
}
