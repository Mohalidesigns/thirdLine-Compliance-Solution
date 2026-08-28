package com.atheris.compliance.tenant.backend.modules.audit.dto;

import com.atheris.compliance.tenant.backend.modules.audit.entity.AuditEvent;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class AuditEventItem {
    private Long eventId;
    private Integer actorUserId;
    private String actorName;
    private String action;
    private String actionDescription;
    private String subjectType;
    private Long subjectId;
    private String evidenceUrl;
    private Instant occurredAt;

    public static AuditEventItem from(AuditEvent e) {
        return from(e, null);
    }

    public static AuditEventItem from(AuditEvent e, String actorName) {
        return AuditEventItem.builder()
            .eventId(e.getEventId()).actorUserId(e.getActorUserId()).actorName(actorName)
            .action(e.getAction()).actionDescription(humanAction(e))
            .subjectType(e.getSubjectType()).subjectId(e.getSubjectId())
            .evidenceUrl(e.getEvidenceUrl()).occurredAt(e.getOccurredAt()).build();
    }

    private static String humanAction(AuditEvent e) {
        if (e.getAction() == null) return "Unknown action";
        return switch (e.getAction()) {
            case "control_created" -> "Control created";
            case "control_updated" -> "Control updated";
            case "control_test_recorded" -> "Control test recorded";
            case "test_reviewed" -> "Test reviewed";
            case "finding_auto_raised" -> "Finding auto-raised from test failure";
            case "finding_raised_manually" -> "Finding raised manually";
            case "finding_assigned" -> "Finding assigned";
            case "remediation_submitted" -> "Remediation submitted";
            case "finding_closed" -> "Finding closed";
            case "return_created" -> "Return created";
            case "return_stage_advanced" -> "Return stage advanced";
            case "return_submitted" -> "Return submitted";
            default -> e.getAction().replace("_", " ");
        };
    }
}
