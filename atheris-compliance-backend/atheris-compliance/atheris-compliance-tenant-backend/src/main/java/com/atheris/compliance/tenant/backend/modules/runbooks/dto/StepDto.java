package com.atheris.compliance.tenant.backend.modules.runbooks.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class StepDto {
    private Long stepId;
    private Integer sortOrder;
    private String stepCode;
    private String title;
    private String instructionMd;
    private String commandBlock;
    private String commandLang;
    private String expectedResult;
    private Integer durationEstimateMin;
    private String assignedRole;
    private Boolean blocking;
    private Boolean dualControl;
    private Boolean allowSkip;
    private String safetyNote;
    @Builder.Default
    private List<Long> clauseIds = new ArrayList<>();
    @Builder.Default
    private List<EvidenceReqDto> evidenceReqs = new ArrayList<>();
}
