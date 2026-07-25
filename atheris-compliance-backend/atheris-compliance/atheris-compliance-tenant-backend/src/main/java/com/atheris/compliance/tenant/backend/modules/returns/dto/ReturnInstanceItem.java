package com.atheris.compliance.tenant.backend.modules.returns.dto;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Data @Builder
public class ReturnInstanceItem {
    private Long instanceId;
    private Long returnId;
    private String returnName;
    private String filingRegulator;
    private String period;
    private LocalDate dueDate;
    private LocalDate prepStartDate;
    private String currentStage;
    private String status;
    private String filingChannel;
    private String stageOwnerName;
    private List<StageSummary> stages;
    private long daysLeft;
    private boolean isOverdue;

    @Data @Builder
    public static class StageSummary {
        public String name;
        public boolean completed;
    }

    private static final List<String> STAGE_ORDER = List.of("Not Started", "Data Gathering", "Draft", "Review", "Sign-off", "Submitted");

    public static ReturnInstanceItem from(ReturnFilingInstance inst, String returnName, String filingRegulator) {
        int currentIdx = STAGE_ORDER.indexOf(inst.getCurrentStage());
        List<StageSummary> stages = STAGE_ORDER.stream().map(s -> {
            int idx = STAGE_ORDER.indexOf(s);
            return StageSummary.builder().name(s).completed(idx < currentIdx || "Submitted".equals(inst.getStatus())).build();
        }).toList();

        LocalDate now = LocalDate.now();
        long daysLeft = inst.getDueDate() != null ? now.until(inst.getDueDate(), ChronoUnit.DAYS) : 0;
        boolean isOverdue = !"Submitted".equals(inst.getStatus()) && !"Submitted Late".equals(inst.getStatus()) && daysLeft < 0;

        return ReturnInstanceItem.builder()
            .instanceId(inst.getInstanceId()).returnId(inst.getReturnId())
            .returnName(returnName).filingRegulator(filingRegulator)
            .period(inst.getPeriod()).dueDate(inst.getDueDate())
            .prepStartDate(inst.getPrepStartDate())
            .currentStage(inst.getCurrentStage()).status(inst.getStatus())
            .filingChannel(inst.getFilingChannel())
            .stages(stages).daysLeft(Math.max(0, daysLeft))
            .isOverdue(isOverdue).build();
    }
}
