package com.atheris.compliance.intelligence.backend.modules.runbooktemplates.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Helpers for reading the portable runbook JSON ({@code atheris-runbook/1}) held as a Map. */
final class RunbookContent {

    private RunbookContent() {}

    static String str(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() ? null : s;
    }

    static Integer integer(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s && !s.isBlank()) {
            try { return Integer.valueOf(s.trim()); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> list(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        if (!(v instanceof List<?> raw)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : raw) if (o instanceof Map<?, ?> map) out.add((Map<String, Object>) map);
        return out;
    }

    static int sectionCount(Map<String, Object> content) {
        return list(content, "sections").size();
    }

    static int stepCount(Map<String, Object> content) {
        return list(content, "sections").stream().mapToInt(s -> list(s, "steps").size()).sum();
    }

    /** "FRAMEWORK clauseRef" strings from the runbook-level {@code clauses}. */
    static List<String> clauseRefs(Map<String, Object> content) {
        List<String> out = new ArrayList<>();
        for (Map<String, Object> c : list(content, "clauses")) {
            String fw = str(c, "framework");
            String ref = str(c, "clauseRef");
            if (ref == null) continue;
            String label = fw == null ? ref : fw + " " + ref;
            if (!out.contains(label)) out.add(label);
        }
        return out;
    }
}
