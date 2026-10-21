package com.atheris.compliance.common.returns;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

public final class ReturnFrequencyClassifier {

    public static final String DAILY = "DAILY";
    public static final String WEEKLY = "WEEKLY";
    public static final String MONTHLY = "MONTHLY";
    public static final String QUARTERLY = "QUARTERLY";
    public static final String SEMI_ANNUAL = "SEMI_ANNUAL";
    public static final String ANNUAL = "ANNUAL";
    public static final String BIENNIAL = "BIENNIAL";
    public static final String EVENT_DRIVEN = "EVENT_DRIVEN";

    private ReturnFrequencyClassifier() {}

    private static final List<String> MOST_FREQUENT_FIRST =
        List.of(DAILY, WEEKLY, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, BIENNIAL);

    public static final List<String> CODES = Arrays.stream(new String[] {
        DAILY, WEEKLY, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, BIENNIAL, EVENT_DRIVEN
    }).toList();

    private static final Map<String, String> ALIASES = new HashMap<>();

    static {
        alias(DAILY, "Daily");
        alias(WEEKLY, "Weekly");
        alias(MONTHLY, "Monthly");
        alias(QUARTERLY, "Quarterly");
        alias(SEMI_ANNUAL, "Semi-Annual");
        alias(ANNUAL, "Annual");
        alias(BIENNIAL, "Biennial");
        alias(EVENT_DRIVEN, "On event");
        for (String code : CODES) {
            ALIASES.putIfAbsent(norm(code), code);
            ALIASES.putIfAbsent(norm(code.replace('_', ' ')), code);
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

    private static final Pattern HALF_YEAR_END = Pattern.compile(
        "half ?year(ly)? end|end of (the|each|every) half ?year");
    private static final Pattern QUARTER_END = Pattern.compile(
        "quarter end|end of (the|each|every) (calendar |financial )?quarter|(each|every) (calendar |financial )?quarter");
    private static final Pattern MONTH_END = Pattern.compile(
        "month end|end of (the|each|every) (calendar )?month");
    private static final Pattern YEAR_END = Pattern.compile(
        "year end|end of (the|each|every|its) (financial |calendar |accounting )?year");
    private static final Pattern CYCLE_WORD = Pattern.compile(
        "\\b(daily|weekly|monthly|quarterly|semi ?annual(ly)?|bi ?annual(ly)?|half ?yearly"
            + "|twice ?yearly|twice a year|annual(ly)?|yearly|biennial(ly)?)\\b");

    public static Optional<String> fromLabel(String raw) {
        if (raw == null || raw.isBlank()) return Optional.empty();
        return Optional.ofNullable(ALIASES.get(norm(raw)));
    }

    public static Optional<String> explicitCycle(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        String f = text.toLowerCase(Locale.ROOT).replace('-', ' ').replaceAll("\\s+", " ");
        var m = CYCLE_WORD.matcher(f);
        String best = null;
        while (m.find()) {
            String c = cycleForWord(m.group(1).replace(" ", ""));
            if (best == null || MOST_FREQUENT_FIRST.indexOf(c) < MOST_FREQUENT_FIRST.indexOf(best)) best = c;
        }
        return Optional.ofNullable(best);
    }

    private static String cycleForWord(String w) {
        if (w.equals("daily")) return DAILY;
        if (w.equals("weekly")) return WEEKLY;
        if (w.equals("monthly")) return MONTHLY;
        if (w.equals("quarterly")) return QUARTERLY;
        if (w.startsWith("bienn")) return BIENNIAL;
        if (w.startsWith("twice")) return SEMI_ANNUAL;
        if (w.startsWith("semi") || w.startsWith("bi") || w.startsWith("half")) return SEMI_ANNUAL;
        return ANNUAL;
    }

    public static Optional<String> periodEndAnchor(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        String f = text.toLowerCase(Locale.ROOT)
            .replaceAll("\\([^)]*\\)", " ")
            .replace('-', ' ').replaceAll("\\s+", " ");
        if (HALF_YEAR_END.matcher(f).find()) return Optional.of(SEMI_ANNUAL);
        if (QUARTER_END.matcher(f).find()) return Optional.of(QUARTERLY);
        if (MONTH_END.matcher(f).find()) return Optional.of(MONTHLY);
        if (YEAR_END.matcher(f).find()) return Optional.of(ANNUAL);
        return Optional.empty();
    }

    public static Optional<String> classify(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        Optional<String> exact = fromLabel(text);
        if (exact.isPresent()) return exact;
        Optional<String> explicit = explicitCycle(text);
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
            || f.contains("on occurrence") || f.contains("on event") || f.contains("after incident")
            || f.contains("after an incident")) {
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

    private static void alias(String code, String... aliases) {
        for (String a : aliases) ALIASES.putIfAbsent(norm(a), code);
    }

    private static String norm(String s) {
        return s.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
