package com.atheris.compliance.tenant.backend.modules.findings.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data @Builder
public class FindingDetailResponse {
    private Long findingId;
    private String displayId;
    private String externalReference;
    private String triggerReason;
    private String findingType;
    private String severity;
    private String description;
    private String rootCause;
    private Integer assignedToUserId;
    private String assignedToName;
    private Instant assignedAt;
    private String status;
    private LocalDate remediationDeadline;
    private Integer slaDays;
    private Long slaRemainingDays;
    private String remediationNotes;
    private String remediationEvidenceUrl;
    private Instant remediationSubmittedAt;
    private Integer ccoSignOffUserId;
    private Instant ccoSignOffAt;
    private Instant closedAt;
    private Long linkedObligationId;
    private Integer linkedControlId;
    /** The linked control's control number, null when unlinked or the control is gone. */
    private String linkedControlNumber;
    private Integer createdByUserId;
    private Instant createdAt;
    private List<TimelineEvent> timeline;

    @Data @Builder
    public static class TimelineEvent {
        private Instant timestamp;
        private String eventType;
        private String description;
        private String actor;
    }
}
