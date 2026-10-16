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
public class StepExecutionDto {
    private Long stepExecId;
    private Long stepId;
    private Long rollbackId;
    private Boolean rollback;
    private Integer sortOrder;
    private String sectionType;
    private String sectionTitle;
    private String stepCode;
    private String title;
    private String instructionMd;
    private String commandBlock;
    private String commandLang;
    private String expectedResult;
    private Integer durationEstimateMin;
    private String assignedRole;
    private Boolean blocking;
    private Boolean dualControl;
    private Boolean allowSkip;
    private String safetyNote;
    private String status;
    private String actualResult;
    private String operatorNotes;
    private String failureCategory;
    private String skipReason;
    private Integer performedByUserId;
    private String performedByName;
    private Integer verifiedByUserId;
    private String verifiedByName;
    private Instant startedAt;
    private Instant completedAt;
    @Builder.Default
    private List<ReqStatus> evidenceReqs = new ArrayList<>();
    @Builder.Default
    private List<EvidenceItemDto> evidence = new ArrayList<>();
    private Boolean mandatoryEvidenceSatisfied;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReqStatus {
        private Long reqId;
        private String evidenceType;
        private String label;
        private Boolean mandatory;
        private Boolean satisfied;
    }
}
