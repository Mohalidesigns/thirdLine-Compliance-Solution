package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

@Component
public class ControlTestDetails {

    public Map<String, String> detailVars(Control c, ControlTask t) {
        Map<String, String> vars = new HashMap<>();
        vars.put("controlName", blank(c.getName()));
        vars.put("controlNumber", blank(c.getControlNumber()));
        vars.put("actName", blank(c.getActName()));
        vars.put("regulator", blank(c.getActName()));
        vars.put("responsiblePerson", blank(c.getTesterName()));
        vars.put("ownerName", blank(c.getControlOwnerName()));
        vars.put("testFrequency", blank(c.getTestFrequency()));
        vars.put("dueDate", due(t));
        return vars;
    }

    public Map<String, String> messageVars(Control c, ControlTask t, String recipientName) {
        Map<String, String> vars = detailVars(c, t);
        vars.put("recipientName", blank(recipientName));
        vars.put("daysLeft", String.valueOf(daysLeft(dueOf(t))));
        vars.put("timing", timing(dueOf(t)));
        return vars;
    }

    public void putResult(Map<String, String> vars, String result, String notes) {
        vars.put("result", blank(result));
        vars.put("reviewNotes", blank(notes));
    }

    static LocalDate dueOf(ControlTask t) {
        return t == null ? null : t.getDueDate();
    }

    private static String due(ControlTask t) {
        LocalDate d = dueOf(t);
        return d == null ? "" : d.toString();
    }

    static long daysLeft(LocalDate due) {
        if (due == null) return 0;
        return Math.max(0, ChronoUnit.DAYS.between(LocalDate.now(), due));
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
