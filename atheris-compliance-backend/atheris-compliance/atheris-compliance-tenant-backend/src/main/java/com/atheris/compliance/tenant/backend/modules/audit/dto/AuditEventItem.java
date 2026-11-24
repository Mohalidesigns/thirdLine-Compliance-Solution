package com.atheris.compliance.tenant.backend.modules.audit.dto;

import com.atheris.compliance.tenant.backend.modules.audit.entity.AuditEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private String fromStep;
    private String toStep;
    private String evidenceUrl;
    private Instant occurredAt;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static AuditEventItem from(AuditEvent e) {
        return from(e, null);
    }

    public static AuditEventItem from(AuditEvent e, String actorName) {
        Steps steps = stepsOf(e.getAfterJson());
        return AuditEventItem.builder()
            .eventId(e.getEventId()).actorUserId(e.getActorUserId()).actorName(actorName)
            .action(e.getAction()).actionDescription(humanAction(e))
            .subjectType(e.getSubjectType()).subjectId(e.getSubjectId())
            .fromStep(steps.from()).toStep(steps.to())
            .evidenceUrl(e.getEvidenceUrl()).occurredAt(e.getOccurredAt()).build();
    }

    private record Steps(String from, String to) {}

    private static Steps stepsOf(String afterJson) {
        if (afterJson == null || afterJson.isBlank()) return new Steps(null, null);
        try {
            JsonNode n = MAPPER.readTree(afterJson);
            String from = text(n, "from");
            String to = text(n, "to");
            if (from == null && to == null) {
                String stage = text(n, "stage");
                if (stage != null) { from = null; to = stage; }
            }
            return new Steps(from, to);
        } catch (Exception ex) {
            return new Steps(null, null);
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String humanAction(AuditEvent e) {
        if (e.getAction() == null) return "Unknown action";
        return switch (e.getAction()) {
            case "control_created" -> "Control created";
            case "control_updated" -> "Control updated";
            case "control_test_recorded" -> "Control test recorded";
            case "test_reviewed" -> "Control test reviewed";
            case "finding_auto_raised" -> "Finding auto-raised from a failed test";
            case "finding_raised_manually" -> "Finding raised manually";
            case "finding_assigned" -> "Finding assigned";
            case "finding_control_linked" -> "Control linked to finding";
            case "remediation_submitted" -> "Remediation submitted";
            case "finding_signed_off" -> "Finding signed off";
            case "finding_rejected" -> "Remediation changes requested";
            case "finding_auto_closed" -> "Finding auto-closed";
            case "gap_finding_closed" -> "Gap finding closed";
            case "return_created" -> "Return created";
            case "return_updated" -> "Return updated";
            case "return_stage_advanced" -> "Return stage advanced";
            case "return_data_submitted" -> "Filing data submitted";
            case "return_reviewed" -> "Return reviewed";
            case "return_proof_filed" -> "Proof of filing attached";
            case "return_filing_link_sent" -> "Filing link sent";
            case "return_escalation_set" -> "Return escalation set";
            case "return_escalation_policy_set" -> "Return escalation policy set";
            case "obligation_created" -> "Obligation created";
            case "obligation_updated" -> "Obligation updated";
            case "assign_owner" -> "Obligation owner assigned";
            case "link_controls" -> "Controls linked to obligation";
            case "link_returns" -> "Returns linked to obligation";
            case "link_sanctions" -> "Sanctions linked to obligation";
            case "update_risk" -> "Obligation risk updated";
            case "classify_obligation" -> "Obligation classified";
            default -> humanise(e.getAction());
        };
    }

    private static String humanise(String action) {
        String s = action.replace('_', ' ');
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
