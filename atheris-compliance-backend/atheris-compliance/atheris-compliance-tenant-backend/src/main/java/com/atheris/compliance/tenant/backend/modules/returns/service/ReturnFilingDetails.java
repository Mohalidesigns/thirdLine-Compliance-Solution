package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class ReturnFilingDetails {

    private final ObligationRepository obligations;

    public Map<String, String> detailVars(RegulatoryReturn r, ReturnFilingInstance inst) {
        Map<String, String> vars = new HashMap<>();
        vars.put("period", inst != null && inst.getPeriod() != null ? inst.getPeriod() : "");
        vars.put("regulator", blank(r.getFilingRegulator()));
        vars.put("actName", blank(r.getActName()));
        vars.put("actObligation", actOrObligation(r));
        vars.put("responsiblePerson", responsibleLabel(r));
        return vars;
    }

    public Map<String, String> messageVars(RegulatoryReturn r, ReturnFilingInstance inst, String recipientName) {
        Map<String, String> vars = detailVars(r, inst);
        LocalDate due = inst == null ? null : inst.getDueDate();
        vars.put("returnName", blank(r.getReturnName()));
        vars.put("recipientName", blank(recipientName));
        vars.put("dueDate", due == null ? "" : due.toString());
        vars.put("daysLeft", String.valueOf(daysLeft(due)));
        vars.put("timing", timing(due));
        return vars;
    }

    public String actOrObligation(RegulatoryReturn r) {
        if (r.getActName() != null && !r.getActName().isBlank()) return r.getActName().trim();
        for (ObligationRepository.LinkedObligationRow o : obligations.findLinkedObligationDetails(r.getReturnId())) {
            String label = firstNonBlank(o.getActName(), o.getTitle(), o.getName(),
                truncate(o.getPlainEnglishStatement(), 120));
            if (label != null) return label;
            if (o.getObligationId() != null) return "Obligation #" + o.getObligationId();
        }
        return "";
    }

    public String responsibleLabel(RegulatoryReturn r) {
        List<String> persons = r.getResponsiblePersons() == null ? List.of() : r.getResponsiblePersons();
        if (!persons.isEmpty()) return String.join(", ", persons);
        return blank(r.getResponsiblePerson());
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

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private static String truncate(String text, int max) {
        if (text == null || text.isBlank()) return null;
        String t = text.trim();
        return t.length() <= max ? t : t.substring(0, max - 1).trim() + "\u2026";
    }
}
