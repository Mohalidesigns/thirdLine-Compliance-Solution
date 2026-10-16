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
public class CoverageDto {
    @Builder.Default
    private List<FrameworkCoverage> frameworks = new ArrayList<>();
    @Builder.Default
    private List<Cell> cells = new ArrayList<>();

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FrameworkCoverage {
        private Integer frameworkId;
        private String code;
        private String name;
        private Integer total;
        private Integer covered;
        private Integer partial;
        private Integer uncovered;
        private Integer coveragePct;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Cell {
        private Long clauseId;
        private Integer frameworkId;
        private String frameworkCode;
        private String clauseRef;
        private String title;
        private String domain;
        private String status;
        @Builder.Default
        private List<RunbookRef> runbooks = new ArrayList<>();
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RunbookRef {
        private Long runbookId;
        private String runbookCode;
        private String title;
        private String status;
    }
}
