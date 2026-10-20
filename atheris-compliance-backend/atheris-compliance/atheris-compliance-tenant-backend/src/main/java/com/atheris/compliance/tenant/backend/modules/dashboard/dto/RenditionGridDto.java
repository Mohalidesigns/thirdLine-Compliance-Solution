package com.atheris.compliance.tenant.backend.modules.dashboard.dto;

import lombok.*;
import java.util.List;
import java.util.Map;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RenditionGridDto {
    private String groupBy;
    private List<String> months;
    private List<GroupRow> groups;
    private Summary summary;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class GroupRow {
        private String name;
        private List<ReturnRow> returns;
        private GroupSummary groupSummary;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ReturnRow {
        private Long returnId;
        private String returnName;
        private String regulator;
        private List<CellStatus> cells;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CellStatus {
        private String period;
        /** OVERDUE | SUBMITTED | SUBMITTED_LATE | IN_PROGRESS | NOT_STARTED | N/A — worst state of the month's periods. */
        private String status;
        /** Next open due date in the month, else the last one. */
        private String dueDate;
        /** Filing periods due in this month (several for daily/weekly returns). */
        private int count;
        private int submitted;
        private int overdue;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class GroupSummary {
        private int total;
        private int submitted;
        private int overdue;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Summary {
        private int totalReturns;
        private int totalSubmitted;
        private int totalOverdue;
        private int totalPending;
    }
}
