package com.atheris.compliance.tenant.backend.modules.dashboard.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class ReturnsByPeriodDto {
    private List<PeriodRow> periods;
    private Summary summary;

    @Data
    @Builder
    public static class PeriodRow {
        private String period;
        private String frequency;
        private String regulator;
        private Long returnId;
        private int total;
        private int submitted;
        private int submittedLate;
        private int inProgress;
        private int notStarted;
        private int overdue;
        private double onTimePercentage;
        private String color;
    }

    @Data
    @Builder
    public static class Summary {
        private int totalInstances;
        private int totalSubmitted;
        private int totalOnTime;
        private int totalPending;
        private int totalOverdue;
        private double overallOnTimePercentage;
        private String overallColor;
        private int approachingDeadlines;
    }
}
