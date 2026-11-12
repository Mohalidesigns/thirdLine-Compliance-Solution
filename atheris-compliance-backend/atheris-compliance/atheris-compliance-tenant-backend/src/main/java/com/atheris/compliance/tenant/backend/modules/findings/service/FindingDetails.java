package com.atheris.compliance.tenant.backend.modules.findings.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
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
    private final ControlTestResultRepository testResults;
    private final ObligationRepository obligations;
    private final OwnerRepository owners;
    private final DepartmentRepository departments;

    public Map<String, String> detailVars(Finding f) {
        Map<String, String> vars = new HashMap<>();
        vars.put("findingId", f.getFindingId() == null ? "" : String.valueOf(f.getFindingId()));
        vars.put("severity", blank(f.getSeverity()));
        vars.put("findingType", blank(f.getFindingType()));
        vars.put("findingDescription", blank(f.getDescription()));
        vars.put("responsiblePerson", blank(f.getAssignedToName()));
        vars.put("remediationDeadline", f.getRemediationDeadline() == null ? "" : f.getRemediationDeadline().toString());
        vars.put("findingStatus", blank(f.getStatus()));

        Control c = control(f);
        vars.put("controlNumber", c == null ? "" : blank(c.getControlNumber()));
        vars.put("controlName", c == null ? "" : blank(c.getName()));
        vars.put("actName", c == null ? "" : blank(c.getActName()));
        vars.put("controlOwner", c == null ? "" : blank(c.getControlOwnerName()));
        vars.put("department", department(c));

        ControlTestResult t = test(f);
        vars.put("testResult", t == null ? "" : blank(t.getResult()));
        vars.put("testDate", t == null || t.getTestDate() == null ? "" : t.getTestDate().toString());

        vars.put("obligation", obligationTitle(f));
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

    private Control control(Finding f) {
        if (f.getLinkedControlId() == null) return null;
        return controls.findById(f.getLinkedControlId()).orElse(null);
    }

    private ControlTestResult test(Finding f) {
        if (f.getTriggeredByTestId() == null) return null;
        return testResults.findById(f.getTriggeredByTestId()).orElse(null);
    }

    private String obligationTitle(Finding f) {
        if (f.getLinkedObligationId() == null) return "";
        return obligations.findById(f.getLinkedObligationId())
            .map(o -> o.getTitle() != null && !o.getTitle().isBlank() ? o.getTitle() : blank(o.getName()))
            .orElse("");
    }

    private String department(Control c) {
        if (c == null || c.getControlOwnerId() == null) return "";
        return owners.findById(c.getControlOwnerId())
            .filter(o -> o.getDepartmentId() != null)
            .flatMap(o -> departments.findById(o.getDepartmentId()))
            .map(d -> blank(d.getName()))
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