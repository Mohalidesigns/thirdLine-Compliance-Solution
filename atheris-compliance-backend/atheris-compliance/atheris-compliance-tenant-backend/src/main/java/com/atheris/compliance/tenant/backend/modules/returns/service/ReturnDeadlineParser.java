package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFrequency;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Derives a {@link DueRule} from the platform's free deadline wording (plus its statutory basis when the
 * wording itself has no date). Returns empty when the deadline is event-relative ("42 days after AGM"),
 * bare ("Annually") or inconsistent with the frequency type — such returns need a due date from a person.
 *
 * <p>Precedence: N months after period end (→ calendar anchor = first period end + N months), N days after
 * period end (→ offset), "the Nth day [of the following month]" or a bare "on or before 5th" (Monthly → offset), explicit calendar dates
 * (→ anchor; month lists must be exactly one cycle apart), "end of financial year" (Annual → 31 Dec).
 * Anchors are stored in the current year and never on 29 Feb.
 */
public final class ReturnDeadlineParser {

    private ReturnDeadlineParser() {}

    /** A parsed rule and whether it came from the statutory basis rather than the deadline text. */
    public record Parsed(DueRule rule, boolean fromStatutoryBasis) {}

    private static final String MONTH_RX = "(january|february|march|april|may|june|july|august|september|october"
        + "|november|december|sept|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\\b";

    private static final Map<String, Integer> MONTHS = Map.ofEntries(
        Map.entry("january", 1), Map.entry("jan", 1), Map.entry("february", 2), Map.entry("feb", 2),
        Map.entry("march", 3), Map.entry("mar", 3), Map.entry("april", 4), Map.entry("apr", 4),
        Map.entry("may", 5), Map.entry("june", 6), Map.entry("jun", 6), Map.entry("july", 7), Map.entry("jul", 7),
        Map.entry("august", 8), Map.entry("aug", 8), Map.entry("september", 9), Map.entry("sept", 9),
        Map.entry("sep", 9), Map.entry("october", 10), Map.entry("oct", 10), Map.entry("november", 11),
        Map.entry("nov", 11), Map.entry("december", 12), Map.entry("dec", 12));

    private static final Map<String, Integer> NUMBER_WORDS = Map.ofEntries(
        Map.entry("one", 1), Map.entry("two", 2), Map.entry("three", 3), Map.entry("four", 4),
        Map.entry("five", 5), Map.entry("six", 6), Map.entry("seven", 7), Map.entry("eight", 8),
        Map.entry("nine", 9), Map.entry("ten", 10), Map.entry("eleven", 11), Map.entry("twelve", 12));

    /** The period whose end a deadline counts from. Group "period" is the period word. */
    private static final String PERIOD_END_RX =
        "(?:the\\s+)?(?:(?:end\\s+of\\s+(?:the\\s+|each\\s+|every\\s+|its\\s+)?)|(?<each>each\\s+|every\\s+))?"
            + "(?:calendar\\s+|financial\\s+|accounting\\s+)?(?<period>month|quarter|half\\s?year|year)"
            + "(?<end>\\s?end)?\\b";

    private static final Pattern MONTHS_AFTER = Pattern.compile(
        "\\b(?<n>\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+months?\\s+"
            + "(?:after|following|from)\\s+" + PERIOD_END_RX);

    private static final Pattern DAYS_AFTER = Pattern.compile(
        "\\b(?<n>\\d{1,3})\\s+(?:calendar\\s+)?days?\\s+(?:after|following|from)\\s+" + PERIOD_END_RX);

    private static final Pattern NTH_DAY = Pattern.compile(
        "\\b(?<n>\\d{1,2})(?:st|nd|rd|th)\\s+(?:calendar\\s+)?day\\b(?<rest>\\s+of\\s+(?:the\\s+)?(?<which>following|next|succeeding|subsequent|same|each|every)?\\s*month)?");

    /**
     * Monthly only: a bare day of month behind a deadline cue — "on or before 5th", "by the 10th",
     * "not later than the 15th of each month". The ordinal must close the clause (end of text or "," / ".")
     * so "by the 2nd schedule", "5th of January", "5th working day" never match.
     */
    private static final Pattern BARE_NTH = Pattern.compile(
        "\\b(?:on\\s+or\\s+before|by|not\\s+later\\s+than|no\\s+later\\s+than)\\s+(?:the\\s+)?"
            + "(?<n>\\d{1,2})(?:st|nd|rd|th)\\b(?:\\s+(?:calendar\\s+)?day\\b)?+"
            + "(?:\\s+(?:of\\s+(?:the\\s+)?(?:(?<which>following|next|succeeding|subsequent|same|each|every)\\s+)?"
            + "|(?:each|every)\\s+)month\\b)?+"
            + "(?=\\s*$|\\s*[,.])");

    /** "5th of January, April, July, and October", "31st Dec", "7th January". */
    private static final Pattern DAY_MONTH_LIST = Pattern.compile(
        "\\b(?<d>\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?" + MONTH_RX
            + "(?<more>(?:\\s*,\\s*(?:and\\s+)?" + MONTH_RX + "|\\s+and\\s+" + MONTH_RX + ")*)");

    /** "February 28", "March 31st". */
    private static final Pattern MONTH_DAY = Pattern.compile("\\b" + MONTH_RX + "\\s+(?<d>\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:days?|months?)\\b)");

    /** "end of April", "the end of the month of June". */
    private static final Pattern END_OF_MONTH = Pattern.compile("\\bend\\s+of\\s+(?:the\\s+month\\s+of\\s+)?" + MONTH_RX);

    private static final Pattern MONTH_NAME = Pattern.compile("\\b" + MONTH_RX);

    private static final Pattern END_OF_YEAR = Pattern.compile(
        "\\bend\\s+of\\s+(?:the\\s+)?(?:financial|calendar|accounting)\\s+year\\b");

    private static final Pattern CYCLE_WORD = Pattern.compile(
        "\\b(daily|weekly|monthly|quarterly|semi ?annual(?:ly)?|bi ?annual(?:ly)?|half ?yearly|twice yearly"
            + "|annual(?:ly)?|yearly|biennial(?:ly)?)\\b");

    // ── platform helpers (shared by the seed and the repair so both reach the same rule) ──

    /** The platform's deadline wording: {@code deadline}, else {@code frequency} (joined when they differ). */
    public static String platformText(PlatformRegulationSeed.ReturnItem p) {
        String d = trimToNull(p.getDeadline());
        String f = trimToNull(p.getFrequency());
        if (d == null) return f;
        if (f == null || f.equalsIgnoreCase(d) || d.toLowerCase(Locale.ROOT).contains(f.toLowerCase(Locale.ROOT))) return d;
        if (f.toLowerCase(Locale.ROOT).contains(d.toLowerCase(Locale.ROOT))) return f;
        return f + " — " + d;
    }

    /**
     * The platform's full frequency text classified with the tenant classifier, which is stricter than
     * intel's {@code ToolkitImportService.classifyFrequency} (leading cycle words and period-end anchors
     * beat "within"; no MONTHLY default). The platform's stored {@code frequencyType} is used only when
     * the text yields nothing — and not when it is MONTHLY, since for unrecognised text that is only
     * intel's default and carries no information.
     */
    public static Optional<ReturnFrequency> platformType(PlatformRegulationSeed.ReturnItem p) {
        Optional<ReturnFrequency> fromText = ReturnFrequency.classify(p.getFrequency());
        if (fromText.isPresent()) return fromText;
        return ReturnFrequency.fromCode(p.getFrequencyType()).filter(t -> t != ReturnFrequency.MONTHLY);
    }

    /** Parse the platform return's wording (statutory basis as fallback) for the given type. */
    public static Optional<Parsed> parsePlatform(PlatformRegulationSeed.ReturnItem p, ReturnFrequency type) {
        return parse(platformText(p), p.getStatutoryBasis(), type);
    }

    /** {@code deadline_text} to store: the platform wording, plus the statutory basis when the date came from it. */
    public static String deadlineText(PlatformRegulationSeed.ReturnItem p, Optional<Parsed> parsed) {
        String text = platformText(p);
        if (parsed.isPresent() && parsed.get().fromStatutoryBasis()) {
            String basis = trimToNull(p.getStatutoryBasis());
            if (basis != null) return text == null ? basis : text + " (" + basis + ")";
        }
        return text;
    }

    // ── parsing ──────────────────────────────────────────────────────────────

    /**
     * @param text  deadline / frequency wording
     * @param basis statutory basis, consulted only when {@code text} yields nothing
     * @param type  frequency type the rule must fit; null = classified from {@code text}
     */
    public static Optional<Parsed> parse(String text, String basis, ReturnFrequency type) {
        ReturnFrequency t = type != null ? type : ReturnFrequency.classify(text).orElse(null);
        if (t == null) return Optional.empty();
        Optional<DueRule> r = parse(text, t);
        if (r.isPresent()) return Optional.of(new Parsed(r.get(), false));
        // A citation is not deadline wording: no bare "by the 2nd" from the statutory basis.
        return parse(basis, t, false).map(rule -> new Parsed(rule, true));
    }

    /** Parse one piece of text for the given frequency type. */
    public static Optional<DueRule> parse(String raw, ReturnFrequency type) {
        return parse(raw, type, true);
    }

    /** @param bareDay accept a bare Monthly day of month ("on or before 5th"); off for the statutory basis */
    private static Optional<DueRule> parse(String raw, ReturnFrequency type, boolean bareDay) {
        if (raw == null || raw.isBlank() || type == null) return Optional.empty();
        int step = DueRule.stepMonths(type);
        if (step <= 0) return Optional.empty(); // daily, weekly, event-driven need no due rule
        String text = segmentFor(normalize(raw), type);

        // 1. "within 3 months after year-end" → anchor at the first period end + N months
        Matcher m = MONTHS_AFTER.matcher(text);
        while (m.find()) {
            if (!periodMatches(m, type)) continue;
            int n = number(m.group("n"));
            if (n < 1 || n > 24) continue;
            YearMonth firstPeriodEnd = YearMonth.of(LocalDate.now().getYear(), Math.min(step, 12));
            LocalDate due = firstPeriodEnd.atEndOfMonth().plusMonths(n);
            return Optional.of(DueRule.date(anchor(due.getMonthValue(), due.getDayOfMonth())));
        }

        // 2. "not later than 30 days after quarter-end" → offset
        m = DAYS_AFTER.matcher(text);
        while (m.find()) {
            if (!periodMatches(m, type)) continue;
            return offsetRule(Integer.parseInt(m.group("n")), type);
        }

        // 3. Monthly: "the 10th day of the following month", "on or before the 5th day"
        if (type == ReturnFrequency.MONTHLY) {
            m = NTH_DAY.matcher(text);
            while (m.find()) {
                String which = m.group("which");
                if (which != null && !which.matches("following|next|succeeding|subsequent")) continue;
                return offsetRule(Integer.parseInt(m.group("n")), type);
            }
            // "on or before 5th", "by the 15th of each month" → the Nth of the following month
            m = bareDay ? BARE_NTH.matcher(text) : null;
            while (m != null && m.find()) {
                String which = m.group("which");
                if (which != null && which.equals("same")) continue;
                return offsetRule(Integer.parseInt(m.group("n")), type);
            }
            return Optional.empty(); // calendar dates mean nothing for a monthly cycle
        }

        // 4. explicit calendar dates
        List<int[]> dates = explicitDates(text);
        if (!dates.isEmpty()) return anchorFromDates(dates, type, step);

        // 5. "End of Financial Year" → 31 Dec
        if ((type == ReturnFrequency.ANNUAL || type == ReturnFrequency.BIENNIAL)
            && END_OF_YEAR.matcher(text).find() && !text.contains("after")) {
            return Optional.of(DueRule.date(anchor(12, 31)));
        }
        return Optional.empty();
    }

    private static Optional<DueRule> offsetRule(int days, ReturnFrequency type) {
        if (!DueRule.offsetSupported(type)) return Optional.empty();
        int max = type == ReturnFrequency.MONTHLY ? 28 : 365;
        if (days < 1 || days > max) return Optional.empty();
        return Optional.of(DueRule.offset(days));
    }

    /** All explicit day/month mentions in text order, as {day, month}. Overlapping matches count once. */
    private static List<int[]> explicitDates(String text) {
        List<int[]> spans = new ArrayList<>();   // {start, end, day, month}
        Matcher m = END_OF_MONTH.matcher(text);
        while (m.find()) {
            int month = MONTHS.get(m.group(1));
            addSpan(spans, m.start(), m.end(), lastDay(month), month);
        }
        m = DAY_MONTH_LIST.matcher(text);
        while (m.find()) {
            int day = Integer.parseInt(m.group("d"));
            if (overlaps(spans, m.start(), m.end())) continue;
            addSpan(spans, m.start(), m.end(), day, MONTHS.get(m.group(2)));
            String more = m.group("more");
            if (more != null && !more.isBlank()) {
                Matcher mm = MONTH_NAME.matcher(more);
                int offset = m.end("more") - more.length();
                while (mm.find())
                    spans.add(new int[]{offset + mm.start(), offset + mm.end(), day, MONTHS.get(mm.group(1))});
            }
        }
        m = MONTH_DAY.matcher(text);
        while (m.find()) {
            if (overlaps(spans, m.start(), m.end())) continue;
            addSpan(spans, m.start(), m.end(), Integer.parseInt(m.group("d")), MONTHS.get(m.group(1)));
        }
        spans.sort((a, b) -> Integer.compare(a[0], b[0]));
        List<int[]> out = new ArrayList<>();
        for (int[] s : spans) {
            if (s[2] < 1 || s[2] > 31) continue;
            out.add(new int[]{s[2], s[3]});
        }
        return out;
    }

    private static void addSpan(List<int[]> spans, int start, int end, int day, int month) {
        if (!overlaps(spans, start, end)) spans.add(new int[]{start, end, day, month});
    }

    private static boolean overlaps(List<int[]> spans, int start, int end) {
        for (int[] s : spans) if (start < s[1] && s[0] < end) return true;
        return false;
    }

    /**
     * One date → that anchor (collapsed to its first occurrence in the cycle for quarterly/semi-annual).
     * Several → all on the same day, consecutive months exactly one cycle apart, at most one cycle's worth.
     */
    private static Optional<DueRule> anchorFromDates(List<int[]> dates, ReturnFrequency type, int step) {
        int day = dates.get(0)[0];
        if (dates.size() > 1) {
            if (step >= 12 || dates.size() > 12 / step) return Optional.empty();
            for (int i = 1; i < dates.size(); i++) {
                if (dates.get(i)[0] != day) return Optional.empty();
                int diff = Math.floorMod(dates.get(i)[1] - dates.get(i - 1)[1], 12);
                if (diff != step) return Optional.empty();
            }
        }
        int month = dates.get(0)[1];
        if (step < 12) month = ((month - 1) % step) + 1;
        return Optional.of(DueRule.date(anchor(month, day)));
    }

    /** Anchor in the current year, clamped to the month length and never on 29 Feb. */
    private static LocalDate anchor(int month, int day) {
        int d = Math.min(day, lastDay(month));
        return LocalDate.of(LocalDate.now().getYear(), month, d);
    }

    private static int lastDay(int month) {
        return month == 2 ? 28 : YearMonth.of(2001, month).lengthOfMonth();
    }

    private static boolean periodMatches(Matcher m, ReturnFrequency type) {
        // A bare period word ("after the year") is not a period end; it needs "end of", "-end" or "each".
        boolean anchored = m.group("end") != null || m.group("each") != null
            || m.group(0).contains("end of");
        if (!anchored) return false;
        String p = m.group("period").replace(" ", "");
        return switch (p) {
            case "month" -> type == ReturnFrequency.MONTHLY;
            case "quarter" -> type == ReturnFrequency.QUARTERLY;
            case "halfyear" -> type == ReturnFrequency.SEMI_ANNUAL;
            case "year" -> type == ReturnFrequency.ANNUAL;
            default -> false;
        };
    }

    private static int number(String s) {
        Integer w = NUMBER_WORDS.get(s);
        return w != null ? w : Integer.parseInt(s);
    }

    /** Lower-case; dashes to spaces; short parenthesised abbreviations ("(FY)", "(6)") dropped; parens to spaces. */
    static String normalize(String raw) {
        String s = raw.toLowerCase(Locale.ROOT)
            .replaceAll("\\(\\s*[a-z0-9]{1,4}\\s*\\)", " ")
            .replaceAll("[\\-‐‑‒–—]", " ")
            .replaceAll("[()\\[\\];:]", " ")
            .replaceAll("\\s+", " ")
            .trim();
        return s;
    }

    /**
     * When the text names several cycles ("Entity: Monthly (...) Consolidated: Quarterly (...)"), keep only the
     * clause that starts at the cycle word for {@code type} and runs to the next different cycle word.
     */
    static String segmentFor(String text, ReturnFrequency type) {
        Matcher m = CYCLE_WORD.matcher(text);
        List<int[]> hits = new ArrayList<>(); // {start, ordinal}
        while (m.find()) {
            ReturnFrequency c = m.group(1).startsWith("twice") ? ReturnFrequency.SEMI_ANNUAL
                : ReturnFrequency.explicitCycle(m.group(1)).orElse(null);
            if (c != null) hits.add(new int[]{m.start(), c.ordinal()});
        }
        if (hits.stream().mapToInt(h -> h[1]).distinct().count() < 2) return text;
        for (int i = 0; i < hits.size(); i++) {
            if (hits.get(i)[1] != type.ordinal()) continue;
            int end = text.length();
            for (int j = i + 1; j < hits.size(); j++) {
                if (hits.get(j)[1] != type.ordinal()) { end = hits.get(j)[0]; break; }
            }
            return text.substring(hits.get(i)[0], end);
        }
        return text;
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
