package com.atheris.compliance.tenant.backend.modules.returns.entity;

import com.atheris.compliance.common.returns.ReturnFrequencyClassifier;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Filing frequency of a regulatory return. {@link #name()} is the code stored in
 * {@code regulatory_returns.frequency_type} (drives instance generation); {@link #label()} is the
 * canonical display text stored in {@code regulatory_returns.frequency}.
 */
public enum ReturnFrequency {
    DAILY("Daily"),
    WEEKLY("Weekly"),
    MONTHLY("Monthly"),
    QUARTERLY("Quarterly"),
    SEMI_ANNUAL("Semi-Annual"),
    ANNUAL("Annual"),
    BIENNIAL("Biennial"),
    EVENT_DRIVEN("On event");

    /** Canonical labels in cycle order, e.g. for dropdowns. */
    public static final List<String> LABELS = Arrays.stream(values()).map(ReturnFrequency::label).toList();

    private static final Map<String, ReturnFrequency> ALIASES = new HashMap<>();

    static {
        for (ReturnFrequency f : values()) {
            ALIASES.put(norm(f.label()), f);
            ALIASES.put(norm(f.name()), f);
            ALIASES.put(norm(f.name().replace('_', ' ')), f);
        }
        alias(DAILY, "day", "every day");
        alias(WEEKLY, "week", "every week");
        alias(MONTHLY, "month", "every month");
        alias(QUARTERLY, "quarter", "every quarter");
        alias(SEMI_ANNUAL, "semi annual", "semiannual", "semi-annually", "semi annually", "bi-annual", "biannual",
            "bi-annually", "biannually", "half-yearly", "half yearly", "every 6 months", "twice yearly");
        alias(ANNUAL, "annually", "yearly", "every year");
        alias(BIENNIAL, "every 2 years", "every two years");
        alias(EVENT_DRIVEN, "ad hoc", "ad-hoc", "adhoc", "event driven", "event-driven", "on occurrence",
            "on event", "after incident", "after an incident", "as required", "triggered");
    }

    private final String label;

    ReturnFrequency(String label) { this.label = label; }

    public String label() { return label; }

    /** Exact (case/whitespace-insensitive) match on a canonical label, code or known alias. */
    public static Optional<ReturnFrequency> fromLabel(String raw) {
        if (raw == null || raw.isBlank()) return Optional.empty();
        return Optional.ofNullable(ALIASES.get(norm(raw)));
    }

    /** Match on a stored {@code frequency_type} code (e.g. {@code SEMI_ANNUAL}). */
    public static Optional<ReturnFrequency> fromCode(String code) {
        if (code == null || code.isBlank()) return Optional.empty();
        try {
            return Optional.of(valueOf(code.trim().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** The most frequent cycle named by an explicit cycle adjective/adverb anywhere in the text. */
    public static Optional<ReturnFrequency> explicitCycle(String text) {
        return ReturnFrequencyClassifier.explicitCycle(text).flatMap(ReturnFrequency::fromCode);
    }

    /** The cycle implied by a period-end anchored deadline (month-end, quarter-end, year-end). */
    public static Optional<ReturnFrequency> periodEndAnchor(String text) {
        return ReturnFrequencyClassifier.periodEndAnchor(text).flatMap(ReturnFrequency::fromCode);
    }

    /** Keyword classification of free frequency text such as "Annually, by 31 March". */
    public static Optional<ReturnFrequency> classify(String text) {
        return ReturnFrequencyClassifier.classify(text).flatMap(ReturnFrequency::fromCode);
    }

    private static void alias(ReturnFrequency f, String... aliases) {
        for (String a : aliases) ALIASES.putIfAbsent(norm(a), f);
    }

    private static String norm(String s) {
        return s.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
