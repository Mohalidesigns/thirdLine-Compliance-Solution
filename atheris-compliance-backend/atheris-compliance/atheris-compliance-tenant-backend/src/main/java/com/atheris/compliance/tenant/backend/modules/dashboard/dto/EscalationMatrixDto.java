package com.atheris.compliance.tenant.backend.modules.dashboard.dto;

import lombok.*;
import java.time.Instant;
import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EscalationMatrixDto {
    private Summary summary;
    private List<EscalationRow> escalations;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EscalationRow {
        private Long returnId;
        private String returnName;
        private String regulator;
        private String department;
        private String areaOfFocus;
        private String returnOwner;
        private String departmentHead;
        private int escalationLevel;
        private String escalationLabel;
        private int daysLate;
        private Instant escalatedAt;
        private String dueDate;
        private String period;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Summary {
        private int total;
        private int l1;
        private int l2;
        private int l3;
    }
}
