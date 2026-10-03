package com.atheris.compliance.tenant.backend.modules.returns.entity;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

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
    EVENT_DRIVEN("Event-driven");

    /** Canonical labels in cycle order, e.g. for dropdowns. */
    public static final List<String> LABELS = Arrays.stream(values()).map(ReturnFrequency::label).toList();

    private static final Map<String, ReturnFrequency> ALIASES = new HashMap<>();

    static {
        for (ReturnFrequency f : values()) {
            ALIASES.put(norm(f.label), f);
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
        alias(EVENT_DRIVEN, "ad hoc", "ad-hoc", "adhoc", "event driven", "on occurrence", "as required");
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

    // Period-end anchors, checked most-frequent cycle first. Hyphens are normalised to spaces beforehand.
    private static final Pattern HALF_YEAR_END = Pattern.compile(
        "half ?year(ly)? end|end of (the|each|every) half ?year");
    private static final Pattern QUARTER_END = Pattern.compile(
        "quarter end|end of (the|each|every) (calendar |financial )?quarter|(each|every) (calendar |financial )?quarter");
    private static final Pattern MONTH_END = Pattern.compile(
        "month end|end of (the|each|every) (calendar )?month");
    private static final Pattern YEAR_END = Pattern.compile(
        "year end|end of (the|each|every|its) (financial |calendar |accounting )?year");

    /** An explicit cycle adjective/adverb, as a whole word anywhere in the text. Nouns ("year", "months") don't count. */
    private static final Pattern CYCLE_WORD = Pattern.compile(
        "\\b(daily|weekly|monthly|quarterly|semi ?annual(ly)?|bi ?annual(ly)?|half ?yearly"
            + "|annual(ly)?|yearly|biennial(ly)?)\\b");

    /**
     * The most frequent cycle named by an explicit cycle adjective/adverb anywhere in the text
     * (daily > weekly > monthly > quarterly > semi-annual > annual > biennial). It wins over any event
     * phrasing: "Annually or upon renewal" is ANNUAL, "Continuous / Annual" ANNUAL, "Solo Basis: Monthly
     * (...) Consolidated Basis: Quarterly (...) Immediately if ..." MONTHLY. Durations such as
     * "within 3 years of the incident" contain no cycle word and are unaffected.
     */
    public static Optional<ReturnFrequency> explicitCycle(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        String f = text.toLowerCase(Locale.ROOT).replace('-', ' ').replaceAll("\\s+", " ");
        var m = CYCLE_WORD.matcher(f);
        ReturnFrequency best = null;
        while (m.find()) {
            ReturnFrequency c = cycleForWord(m.group(1).replace(" ", ""));
            if (best == null || c.ordinal() < best.ordinal()) best = c; // enum order = most frequent first
        }
        return Optional.ofNullable(best);
    }

    private static ReturnFrequency cycleForWord(String w) {
        if (w.equals("daily")) return DAILY;
        if (w.equals("weekly")) return WEEKLY;
        if (w.equals("monthly")) return MONTHLY;
        if (w.equals("quarterly")) return QUARTERLY;
        if (w.startsWith("bienn")) return BIENNIAL;
        if (w.startsWith("semi") || w.startsWith("bi") || w.startsWith("half")) return SEMI_ANNUAL;
        return ANNUAL;
    }

    /**
     * The cycle implied by a period-end anchored deadline: "within 30 days after month-end" is MONTHLY,
     * "quarter-end" / "end of each quarter" QUARTERLY, "year-end" / "financial year end" /
     * "end of the year" ANNUAL. Such deadlines recur with the period even though they say "within".
     */
    public static Optional<ReturnFrequency> periodEndAnchor(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        String f = text.toLowerCase(Locale.ROOT)
            .replaceAll("\\([^)]*\\)", " ")      // "Financial year (FY) end", "six (6) months"
            .replace('-', ' ').replaceAll("\\s+", " ");
        if (HALF_YEAR_END.matcher(f).find()) return Optional.of(SEMI_ANNUAL);
        if (QUARTER_END.matcher(f).find()) return Optional.of(QUARTERLY);
        if (MONTH_END.matcher(f).find()) return Optional.of(MONTHLY);
        if (YEAR_END.matcher(f).find()) return Optional.of(ANNUAL);
        return Optional.empty();
    }

    /**
     * Keyword classification of free frequency text such as "Annually, by 31 March" or
     * "Within 30 days of receipt". Mirrors the platform's {@code ToolkitImportService.classifyFrequency}
     * (event-driven phrasing checked first), except that an explicit cycle adjective/adverb anywhere in
     * the text ({@link #explicitCycle}, most frequent wins) beats everything, a period-end anchor ({@link #periodEndAnchor})
     * wins over the event-driven phrasing, and it returns empty instead of defaulting to MONTHLY when
     * nothing is recognised.
     */
    public static Optional<ReturnFrequency> classify(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        Optional<ReturnFrequency> exact = fromLabel(text);
        if (exact.isPresent()) return exact;
        Optional<ReturnFrequency> explicit = explicitCycle(text);
        if (explicit.isPresent()) return explicit;
        String f = text.trim().toLowerCase(Locale.ROOT);

        boolean periodic = f.contains("month") || f.contains("quarter") || f.contains("year");
        if (f.contains("within") || f.contains("upon") || f.contains("on request")
            || f.contains("as required") || f.contains("as directed")
            || f.contains("as determined") || f.contains("as prescribed")
            || f.contains("immediately") || f.contains("no fixed timeline")
            || f.contains("ongoing") || f.contains("continuous")
            || f.contains("as detected") || f.contains("as disputes")
            || f.contains("per risk") || f.contains("triggered")
            || f.contains("from date") || f.contains("on-demand")
            || f.contains("during") || f.contains("in advance")
            || f.contains("at least") || f.contains("without delay")
            || f.contains("not less than")
            || (f.contains("not later than") && !periodic)
            || f.contains("after the meeting") || f.contains("after commencement")
            || f.contains("ad hoc") || f.contains("event driven") || f.contains("event-driven")
            || f.contains("on occurrence")) {
            return periodEndAnchor(f).or(() -> Optional.of(EVENT_DRIVEN));
        }

        if (f.contains("daily")) return Optional.of(DAILY);
        if (f.contains("weekly")) return Optional.of(WEEKLY);
        if (f.contains("semi") || f.contains("twice yearly") || f.contains("every 6 months")
            || f.contains("bi-annual") || f.contains("biannual") || f.contains("half-year") || f.contains("half year"))
            return Optional.of(SEMI_ANNUAL);
        if (f.contains("quarter")) return Optional.of(QUARTERLY);
        if (f.contains("every 2 years") || f.contains("biennial")) return Optional.of(BIENNIAL);
        if (f.contains("annual") || f.contains("once per calendar year") || f.contains("year"))
            return Optional.of(ANNUAL);
        if (f.contains("monthly")) return Optional.of(MONTHLY);
        return periodEndAnchor(f);
    }

    private static void alias(ReturnFrequency f, String... aliases) {
        for (String a : aliases) ALIASES.putIfAbsent(norm(a), f);
    }

    private static String norm(String s) {
        return s.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
