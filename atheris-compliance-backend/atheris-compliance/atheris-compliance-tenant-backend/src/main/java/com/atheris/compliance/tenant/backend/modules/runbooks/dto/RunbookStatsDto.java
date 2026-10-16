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
public class RunbookStatsDto {
    private Long total;
    private Long published;
    private Long draft;
    private Long inReview;
    private Long deprecated;
    private Long dueIn30Days;
    private Long overdueReviews;
    private Long failedLastRun;
    private Long activeExecutions;
    private Map<String,Long> byCategory;
    private Map<String,Long> byStatus;
    private Map<String,Long> byCriticality;
}
