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
public class LintReportDto {
    private Integer errors;
    private Integer warnings;
    @Builder.Default
    private List<LintIssue> issues = new ArrayList<>();

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LintIssue {
        private String rule;
        private String severity;
        private String message;
        private String stepCode;
        private Integer sectionIndex;
        private Integer stepIndex;
    }
}
