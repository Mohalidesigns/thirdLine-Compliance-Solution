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
public class VersionDiffDto {
    private Integer fromVersionNumber;
    private Integer toVersionNumber;
    @Builder.Default
    private List<StepDiffDto> added = new ArrayList<>();
    @Builder.Default
    private List<StepDiffDto> removed = new ArrayList<>();
    @Builder.Default
    private List<StepDiffDto> changed = new ArrayList<>();
    @Builder.Default
    private List<FieldChange> metadata = new ArrayList<>();

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StepDiffDto {
        private String stepCode;
        private String title;
        @Builder.Default
        private List<FieldChange> changes = new ArrayList<>();
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FieldChange {
        private String field;
        private String before;
        private String after;
    }
}
