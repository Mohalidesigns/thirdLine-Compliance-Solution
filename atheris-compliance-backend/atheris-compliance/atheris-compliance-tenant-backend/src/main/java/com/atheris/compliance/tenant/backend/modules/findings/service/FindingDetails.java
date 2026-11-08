package com.atheris.compliance.tenant.backend.modules.findings.service;

import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class FindingDetails {

    private final ControlRepository controls;

    public Map<String, String> detailVars(Finding f) {
        Map<String, String> vars = new HashMap<>();
        vars.put("findingId", f.getFindingId() == null ? "" : String.valueOf(f.getFindingId()));
        vars.put("severity", blank(f.getSeverity()));
        vars.put("findingType", blank(f.getFindingType()));
        vars.put("controlNumber", controlNumber(f));
        vars.put("responsiblePerson", blank(f.getAssignedToName()));
        vars.put("remediationDeadline", f.getRemediationDeadline() == null ? "" : f.getRemediationDeadline().toString());
        vars.put("findingStatus", blank(f.getStatus()));
        return vars;
    }

    public Map<String, String> messageVars(Finding f, String recipientName) {
        Map<String, String> vars = detailVars(f);
        vars.put("recipientName", blank(recipientName));
        vars.put("daysLeft", String.valueOf(daysLeft(f.getRemediationDeadline())));
        vars.put("daysLate", String.valueOf(daysLate(f.getRemediationDeadline())));
        vars.put("timing", timing(f.getRemediationDeadline()));
        return vars;
    }

    public void putReviewNotes(Map<String, String> vars, String notes) {
        vars.put("reviewNotes", blank(notes));
    }

    private String controlNumber(Finding f) {
        if (f.getLinkedControlId() == null) return "";
        return controls.findById(f.getLinkedControlId())
            .map(c -> c.getControlNumber() == null ? "" : c.getControlNumber())
            .orElse("");
    }

    static long daysLeft(LocalDate due) {
        if (due == null) return 0;
        return Math.max(0, ChronoUnit.DAYS.between(LocalDate.now(), due));
    }

    static long daysLate(LocalDate due) {
        if (due == null) return 0;
        return Math.max(0, ChronoUnit.DAYS.between(due, LocalDate.now()));
    }

    static String timing(LocalDate due) {
        if (due == null) return "";
        long diff = ChronoUnit.DAYS.between(LocalDate.now(), due);
        if (diff > 0) return ", " + diff + " day(s) away";
        if (diff == 0) return ", due today";
        return ", " + (-diff) + " day(s) overdue";
    }

    private static String blank(String s) {
        return s == null ? "" : s;
    }
}
