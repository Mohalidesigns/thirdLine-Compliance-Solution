package com.atheris.compliance.tenant.backend.modules.returns.dto;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnStage;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Data @Builder
public class ReturnInstanceDetailResponse {
    private Long instanceId;
    private Long returnId;
    private String returnName;
    /** The governing act's platform regulation id (see {@code regulatory_returns.act_id}). */
    private Long actId;
    private String actName;
    private String frequency;
    private String frequencyType;
    private String deadlineText;
    private String eventTriggerLabel;
    private String eventDeadlineMode;
    private Integer eventDeadlineDays;
    private String eventDeadlineUnit;
    private String filingRegulator;
    private String period;
    private LocalDate dueDate;
    private LocalDate prepStartDate;
    private String currentStage;
    private String status;
    private String filingChannel;
    private String returnOwnerName;
    private Integer stageOwnerUserId;
    private LocalDate submittedDate;
    private Integer submittedByUserId;
    private String submissionEvidenceUrl;
    private boolean pendingReview;
    private String reviewEvidenceRef;
    private String reviewSubmittedByName;
    private String reviewSubmittedByEmail;
    private Instant reviewSubmittedAt;
    private Integer reviewSubmittedByUserId;
    private String reviewDecision;
    private String reviewNotes;
    private Instant reviewedAt;
    private Integer reviewedByUserId;
    private Instant completedAt;
    private int daysLate;
    private Integer escalationLevel;
    private Instant escalatedAt;
    private String notes;
    private LocalDate eventTriggerDate;
    private String eventReference;
    private Long eventEvidenceFileId;
    private LocalDate eventUnadjustedDueDate;
    private boolean eventDueDateAdjusted;
    private List<StageInfo> stages;

    @Data @Builder
    public static class StageInfo {
        private String name;
        private boolean completed;
        private String completedAt;
        private String evidenceUrl;
        private String completedByName;
        private boolean isCurrent;
    }

    private static final List<ReturnStage> STAGE_ORDER =
        List.of(ReturnStage.NOT_STARTED, ReturnStage.DATA_GATHERING, ReturnStage.DRAFT,
            ReturnStage.REVIEW, ReturnStage.COMPLETED);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static ReturnInstanceDetailResponse from(ReturnFilingInstance inst,
            String returnName, String filingRegulator, String returnOwnerName) {
        Map<String, Map<String, String>> stageData = parseStageData(inst.getStageData());
        int currentIdx = STAGE_ORDER.indexOf(inst.getCurrentStage());
        ReturnFilingStatus status = inst.getStatus();
        boolean completed = inst.getCurrentStage() == ReturnStage.COMPLETED;
        List<StageInfo> stages = new ArrayList<>();
        for (int i = 0; i < STAGE_ORDER.size(); i++) {
            ReturnStage rs = STAGE_ORDER.get(i);
            String name = rs.db();
            Map<String, String> data = stageData.getOrDefault(name, new HashMap<>());
            stages.add(StageInfo.builder()
                .name(name)
                .completed(data.containsKey("completedAt") || i < currentIdx || completed)
                .completedAt(data.get("completedAt"))
                .evidenceUrl(data.get("evidenceUrl"))
                .completedByName(data.get("completedByName"))
                .isCurrent(rs.equals(inst.getCurrentStage()))
                .build());
        }
        return ReturnInstanceDetailResponse.builder()
            .instanceId(inst.getInstanceId()).returnId(inst.getReturnId())
            .returnName(returnName).filingRegulator(filingRegulator)
            .period(inst.getPeriod()).dueDate(inst.getDueDate())
            .prepStartDate(inst.getPrepStartDate())
            .currentStage(inst.getCurrentStage() != null ? inst.getCurrentStage().db() : null)
            .status(status != null ? status.db() : null)
            .filingChannel(inst.getFilingChannel()).returnOwnerName(returnOwnerName)
            .stageOwnerUserId(inst.getStageOwnerUserId())
            .submittedDate(inst.getSubmittedDate())
            .submittedByUserId(inst.getSubmittedByUserId())
            .submissionEvidenceUrl(inst.getSubmissionEvidenceUrl())
            .pendingReview(inst.isPendingReview())
            .reviewEvidenceRef(inst.getReviewEvidenceRef())
            .reviewSubmittedByName(inst.getReviewSubmittedByName())
            .reviewSubmittedByEmail(inst.getReviewSubmittedByEmail())
            .reviewSubmittedAt(inst.getReviewSubmittedAt())
            .reviewSubmittedByUserId(inst.getReviewSubmittedByUserId())
            .reviewDecision(inst.getReviewDecision())
            .reviewNotes(inst.getReviewNotes())
            .reviewedAt(inst.getReviewedAt())
            .reviewedByUserId(inst.getReviewedByUserId())
            .completedAt(inst.getCompletedAt())
            .daysLate(inst.getDaysLate() != null ? inst.getDaysLate() : 0)
            .escalationLevel(inst.getEscalationLevel())
            .escalatedAt(inst.getEscalatedAt())
            .notes(inst.getNotes())
            .eventTriggerDate(inst.getTriggerDate()).eventReference(inst.getEventReference())
            .eventEvidenceFileId(inst.getEventEvidenceFileId()).eventUnadjustedDueDate(inst.getUnadjustedDueDate())
            .eventDueDateAdjusted(inst.isDueDateAdjusted()).stages(stages).build();
    }

    private static Map<String, Map<String, String>> parseStageData(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return MAPPER.readValue(json, new TypeReference<Map<String, Map<String, String>>>() {});
        } catch (Exception e) {
            return new HashMap<>();
        }
    }
}
