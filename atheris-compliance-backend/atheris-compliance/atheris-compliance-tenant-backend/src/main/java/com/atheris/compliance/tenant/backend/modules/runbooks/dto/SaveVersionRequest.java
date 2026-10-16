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
public class SaveVersionRequest {
    @Builder.Default
    private List<PrerequisiteDto> prerequisites = new ArrayList<>();
    @Builder.Default
    private List<SectionDto> sections = new ArrayList<>();
    @Builder.Default
    private List<EscalationDto> escalations = new ArrayList<>();
    @Builder.Default
    private List<RollbackStepDto> rollbackSteps = new ArrayList<>();
}
