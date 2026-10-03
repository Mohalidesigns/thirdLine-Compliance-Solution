package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFrequency;

import java.time.LocalDate;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The due-date rule of a return. Two mutually exclusive kinds:
 * <ul>
 *   <li>{@link Kind#DATE} — a fixed calendar anchor ({@code regulatory_returns.filing_date}); instances fall
 *       on anchor + k cycles (e.g. 30 Jun every year; 5 Jan/Apr/Jul/Oct).</li>
 *   <li>{@link Kind#OFFSET} — {@code due_days_after_period_end}; each calendar-aligned period (months; quarters
 *       ending Mar/Jun/Sep/Dec; half-years Jun/Dec; years Dec) is due its end + N days. Month-based cycles up
 *       to Annual only.</li>
 * </ul>
 */
public record DueRule(Kind kind, LocalDate firstDueDate, Integer daysAfterPeriodEnd) {

    public enum Kind { DATE, OFFSET }

    /** {@code due_date_source}: derived from the platform's deadline wording. */
    public static final String SOURCE_PLATFORM_TEXT = "platform_text";
    /** {@code due_date_source}: set by a person (schedule edit, Add Return, import). */
    public static final String SOURCE_USER = "user";

    public static DueRule date(LocalDate anchor) { return new DueRule(Kind.DATE, anchor, null); }

    public static DueRule offset(int days) { return new DueRule(Kind.OFFSET, null, days); }

    /** Cycle length in months for month-based frequencies, else 0 (daily, weekly, event-driven). */
    public static int stepMonths(ReturnFrequency f) {
        if (f == null) return 1;
        return switch (f) {
            case MONTHLY -> 1;
            case QUARTERLY -> 3;
            case SEMI_ANNUAL -> 6;
            case ANNUAL -> 12;
            case BIENNIAL -> 24;
            default -> 0;
        };
    }

    /** The return's frequency, defaulting to MONTHLY like instance generation does. */
    public static ReturnFrequency typeOf(RegulatoryReturn r) {
        String code = r.getFrequencyType();
        if (code == null || code.isBlank()) return ReturnFrequency.MONTHLY;
        return ReturnFrequency.fromCode(code).orElse(ReturnFrequency.MONTHLY);
    }

    /** An offset rule is usable only on month-based cycles up to a year. */
    public static boolean offsetSupported(ReturnFrequency f) {
        int s = stepMonths(f);
        return s >= 1 && s <= 12;
    }

    /** The rule instance generation uses for this return, or null when it has none. */
    public static DueRule of(RegulatoryReturn r) {
        ReturnFrequency f = typeOf(r);
        if (r.getDueDaysAfterPeriodEnd() != null && offsetSupported(f)) return offset(r.getDueDaysAfterPeriodEnd());
        if (r.getFilingDate() != null) return date(r.getFilingDate());
        return null;
    }

    /**
     * Monthly-or-longer return with no usable rule: no periods are generated until someone sets a due date.
     */
    public static boolean dueDateNeeded(RegulatoryReturn r) {
        return stepMonths(typeOf(r)) > 0 && of(r) == null;
    }

    /**
     * Comparable form, independent of the anchor's year: offsets by their days; anchors by their first
     * occurrence within the cycle (month = ((m-1) mod cycle) + 1, day). Raw dates are never compared.
     */
    public String canonical(ReturnFrequency f) {
        if (kind == Kind.OFFSET) return "O:" + daysAfterPeriodEnd;
        int step = stepMonths(f);
        if (step <= 0) {
            if (f == ReturnFrequency.WEEKLY) return "W:" + firstDueDate.getDayOfWeek();
            return "D";
        }
        int cycle = Math.min(step, 12);
        int month = ((firstDueDate.getMonthValue() - 1) % cycle) + 1;
        return "A:" + month + "-" + firstDueDate.getDayOfMonth();
    }

    /** Human wording, e.g. "30 Jun each year", "5 Jan, Apr, Jul, Oct", "10 days after period end". */
    public String describe(ReturnFrequency f) {
        if (kind == Kind.OFFSET) return daysAfterPeriodEnd + " days after period end";
        int day = firstDueDate.getDayOfMonth();
        int step = stepMonths(f);
        if (step <= 0) {
            if (f == ReturnFrequency.WEEKLY)
                return "Every " + firstDueDate.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
            if (f == ReturnFrequency.DAILY) return "Every day";
            return "From " + firstDueDate;
        }
        if (step == 1) return "Day " + day + " of each month";
        if (step == 12) return day + " " + mon(firstDueDate.getMonthValue()) + " each year";
        if (step == 24) return day + " " + mon(firstDueDate.getMonthValue()) + " every 2 years";
        int first = ((firstDueDate.getMonthValue() - 1) % step) + 1;
        List<String> months = new ArrayList<>();
        for (int m = first; m <= 12; m += step) months.add(mon(m));
        return day + " " + String.join(", ", months);
    }

    /** Wording for "no rule" on a return of this type. {@code legacyInstances}: it still has rule-less periods. */
    public static String describeNone(ReturnFrequency f, boolean legacyInstances) {
        if (f == ReturnFrequency.EVENT_DRIVEN) return "Event-driven (no schedule)";
        if (stepMonths(f) <= 0) return f == ReturnFrequency.WEEKLY ? "Every week (no rule)" : "Every day (no rule)";
        if (legacyInstances) return "Due 1st of each " + (f == ReturnFrequency.MONTHLY ? "month" : "period") + " (no rule)";
        return "Due date needed";
    }

    private static String mon(int m) {
        return Month.of(m).getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
    }
}
