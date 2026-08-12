package com.atheris.compliance.tenant.backend.modules.returns.dto;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnStage;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;
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
    private Integer escalationLevel;
    private Instant escalatedAt;
    private List<StageSummary> stages;
    private long daysLeft;
    private boolean isOverdue;

    @Data @Builder
    public static class StageSummary {
        public String name;
        public boolean completed;
    }

    private static final List<ReturnStage> STAGE_ORDER =
        List.of(ReturnStage.NOT_STARTED, ReturnStage.DATA_GATHERING, ReturnStage.DRAFT,
            ReturnStage.REVIEW, ReturnStage.SIGN_OFF, ReturnStage.SUBMITTED);

    public static ReturnInstanceItem from(ReturnFilingInstance inst, String returnName, String filingRegulator) {
        int currentIdx = STAGE_ORDER.indexOf(inst.getCurrentStage());
        List<StageSummary> stages = STAGE_ORDER.stream().map(s -> {
            int idx = STAGE_ORDER.indexOf(s);
            return StageSummary.builder().name(s.db()).completed(
                idx < currentIdx || ReturnFilingStatus.SUBMITTED.equals(inst.getStatus())
                    || ReturnFilingStatus.SUBMITTED_LATE.equals(inst.getStatus()))
                .build();
        }).toList();

        LocalDate now = LocalDate.now();
        long daysLeft = inst.getDueDate() != null ? now.until(inst.getDueDate(), ChronoUnit.DAYS) : 0;
        boolean isOverdue = !ReturnFilingStatus.SUBMITTED.equals(inst.getStatus())
            && !ReturnFilingStatus.SUBMITTED_LATE.equals(inst.getStatus()) && daysLeft < 0;

        return ReturnInstanceItem.builder()
            .instanceId(inst.getInstanceId()).returnId(inst.getReturnId())
            .returnName(returnName).filingRegulator(filingRegulator)
            .period(inst.getPeriod()).dueDate(inst.getDueDate())
            .prepStartDate(inst.getPrepStartDate())
            .currentStage(inst.getCurrentStage() != null ? inst.getCurrentStage().db() : null)
            .status(inst.getStatus() != null ? inst.getStatus().db() : null)
            .filingChannel(inst.getFilingChannel())
            .escalationLevel(inst.getEscalationLevel())
            .escalatedAt(inst.getEscalatedAt())
            .stages(stages).daysLeft(Math.max(0, daysLeft))
            .isOverdue(isOverdue).build();
    }
}
