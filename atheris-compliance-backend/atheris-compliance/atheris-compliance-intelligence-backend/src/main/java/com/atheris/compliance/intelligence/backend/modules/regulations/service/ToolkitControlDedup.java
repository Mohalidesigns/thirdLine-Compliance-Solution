package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure helpers that make the toolkit's CRMP control import idempotent.
 *
 * <p>A CRMP control is identified by its <b>natural key</b>: act id + normalised control text
 * (trimmed, whitespace collapsed, case-insensitive) + control type (PRIMARY / ADDITIONAL).
 * Control numbers are generated, so they can never be used to detect a re-run.
 *
 * <p>No database access here — callers load rows once and persist the outcome.
 */
final class ToolkitControlDedup {

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private ToolkitControlDedup() {}

    /** Trim, collapse internal whitespace, lower-case. Null/blank → "". */
    static String normalizeText(String text) {
        if (text == null) return "";
        return WHITESPACE.matcher(text.trim()).replaceAll(" ").toLowerCase(Locale.ROOT);
    }

    static String naturalKey(Long actId, String controlText, String controlType) {
        String type = controlType == null || controlType.isBlank()
            ? "PRIMARY" : controlType.trim().toUpperCase(Locale.ROOT);
        return (actId == null ? "-" : actId.toString()) + '|' + type + '|' + normalizeText(controlText);
    }

    static String naturalKey(ComplianceControl c) {
        return naturalKey(c.getActId(), c.getComplianceControl(), c.getControlType());
    }

    /** Union of two comma-separated id lists, order-preserving, de-duplicated; null when empty. */
    static String mergeLinkedIds(String a, String b) {
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        for (String list : new String[] { a, b }) {
            if (list == null) continue;
            for (String s : list.split(",")) {
                String t = s.trim();
                if (!t.isEmpty()) ids.add(t);
            }
        }
        return ids.isEmpty() ? null : String.join(",", ids);
    }

    /** The oldest row wins: lowest createdAt, then lowest id. */
    static final Comparator<ComplianceControl> OLDEST_FIRST = Comparator
        .comparing(ComplianceControl::getCreatedAt, Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
        .thenComparing(ComplianceControl::getComplianceControlId, Comparator.nullsLast(Comparator.<Long>naturalOrder()));

    /** One natural-key group with more than one row. */
    record DuplicateGroup(ComplianceControl keep, List<ComplianceControl> duplicates) {}

    /**
     * Groups the given rows by natural key. Within each group, every row created on the same
     * calendar day as the group's oldest row is the original seed and is left untouched (the
     * toolkit legitimately repeats a control across sections); only rows created on a LATER day
     * are re-inserts and become {@code duplicates}, with the oldest row as {@code keep}. Rows for
     * which {@code deletable} is false (still referenced elsewhere) are never put in
     * {@code duplicates}. Days are taken in {@code zone}.
     */
    static List<DuplicateGroup> findDuplicates(Collection<ComplianceControl> rows,
                                               Predicate<ComplianceControl> deletable,
                                               ZoneId zone) {
        Map<String, List<ComplianceControl>> byKey = new LinkedHashMap<>();
        for (ComplianceControl c : rows) {
            byKey.computeIfAbsent(naturalKey(c), k -> new ArrayList<>()).add(c);
        }
        List<DuplicateGroup> groups = new ArrayList<>();
        for (List<ComplianceControl> group : byKey.values()) {
            if (group.size() < 2) continue;
            group.sort(OLDEST_FIRST);
            ComplianceControl keep = group.get(0);
            LocalDate seedDay = day(keep, zone);
            List<ComplianceControl> dups = group.subList(1, group.size()).stream()
                .filter(c -> isLaterDay(day(c, zone), seedDay))
                .filter(deletable).toList();
            if (!dups.isEmpty()) groups.add(new DuplicateGroup(keep, dups));
        }
        return groups;
    }

    private static LocalDate day(ComplianceControl c, ZoneId zone) {
        return c.getCreatedAt() == null ? null : LocalDate.ofInstant(c.getCreatedAt(), zone);
    }

    /** A row with no timestamp is never treated as a later re-insert. */
    private static boolean isLaterDay(LocalDate day, LocalDate seedDay) {
        return day != null && seedDay != null && day.isAfter(seedDay);
    }

    /**
     * Folds a re-inserted duplicate into the kept (oldest) row: only the linked obligation ids are
     * unioned — every other field of the original seed row stays as it is. Returns true if
     * {@code keep} changed.
     */
    static boolean mergeInto(ComplianceControl keep, ComplianceControl dup) {
        String links = mergeLinkedIds(keep.getLinkedObligationIds(), dup.getLinkedObligationIds());
        if (Objects.equals(links, keep.getLinkedObligationIds())) return false;
        keep.setLinkedObligationIds(links);
        return true;
    }

    /**
     * Allocates control numbers of the form {@code <prefix><nnn>} that never collide with an
     * existing number: continues from the highest numeric suffix already used with that prefix
     * and skips anything already in {@code taken}. Allocated numbers are added to {@code taken}.
     */
    static final class NumberAllocator {
        private final Set<String> taken;
        private final Map<String, Integer> highest = new HashMap<>();

        NumberAllocator(Collection<String> existingNumbers) {
            this.taken = new HashSet<>();
            for (String n : existingNumbers) if (n != null) taken.add(n);
        }

        boolean isTaken(String number) {
            return taken.contains(number);
        }

        void reserve(String number) {
            taken.add(number);
        }

        String next(String prefix) {
            int n = highest.computeIfAbsent(prefix, this::scanHighest);
            String candidate;
            do {
                n++;
                candidate = prefix + String.format("%03d", n);
            } while (taken.contains(candidate));
            highest.put(prefix, n);
            taken.add(candidate);
            return candidate;
        }

        private int scanHighest(String prefix) {
            Pattern p = Pattern.compile(Pattern.quote(prefix) + "(\\d+)");
            int max = 0;
            for (String t : taken) {
                Matcher m = p.matcher(t);
                if (m.matches()) {
                    try { max = Math.max(max, Integer.parseInt(m.group(1))); }
                    catch (NumberFormatException ignored) { /* absurdly long suffix */ }
                }
            }
            return max;
        }
    }

    /** Index rows by natural key, first (oldest) row wins. */
    static Map<String, ComplianceControl> indexByKey(Collection<ComplianceControl> rows) {
        Map<String, ComplianceControl> idx = new HashMap<>();
        rows.stream().sorted(OLDEST_FIRST).forEach(c -> idx.putIfAbsent(naturalKey(c), c));
        return idx;
    }
}
