package com.atheris.compliance.tenant.backend.modules.returns.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class ReturnRegisterItem {
    private Long returnId;
    private String returnName;
    private String actName;
    private String filingRegulator;
    private String frequency;
    private String frequencyType;
    private String responsibleUnit;
    private String responsiblePerson;
    private String currentPeriod;
    private LocalDate currentDueDate;
    private String currentStatus;
    private String currentStage;
    private Long currentInstanceId;
    private List<InstanceSummary> upcomingInstances;
    private int totalInstances;
    private int overdueCount;
    private boolean hasOverdue;

    @Data @Builder
    public static class InstanceSummary {
        private Long instanceId;
        private String period;
        private LocalDate dueDate;
        private String status;
        private String stage;
    }
}
