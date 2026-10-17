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
public class RunbookDashboardDto {
    private Long upcoming7d;
    private Long overdue;
    private Long openEscalations;
    private Long reviewBacklog;
    private Long pendingApprovals;
    private Long activeExecutions;
    @Builder.Default
    private List<Upcoming> upcoming = new ArrayList<>();

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Upcoming {
        private Long runbookId;
        private String runbookCode;
        private String title;
        private LocalDate nextRunAt;
    }
}
