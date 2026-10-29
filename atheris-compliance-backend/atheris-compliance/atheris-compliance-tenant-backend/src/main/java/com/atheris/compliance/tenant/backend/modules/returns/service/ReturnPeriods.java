package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.util.ArrayList;
import java.util.List;

final class ReturnPeriods {

    enum Unit { DAY, WEEK, MONTH }

    record Step(Unit unit, int amount) {}

    record Occurrence(String period, LocalDate due) {}

    private ReturnPeriods() {
    }

    static Step stepFor(String frequencyType) {
        if (frequencyType == null) return new Step(Unit.MONTH, 1);
        return switch (frequencyType) {
            case "DAILY"        -> new Step(Unit.DAY, 1);
            case "WEEKLY"       -> new Step(Unit.WEEK, 1);
            case "QUARTERLY"    -> new Step(Unit.MONTH, 3);
            case "SEMI_ANNUAL"  -> new Step(Unit.MONTH, 6);
            case "ANNUAL"       -> new Step(Unit.MONTH, 12);
            case "BIENNIAL"     -> new Step(Unit.MONTH, 24);
            case "EVENT_DRIVEN" -> null;
            default             -> new Step(Unit.MONTH, 1);
        };
    }

    static Occurrence next(RegulatoryReturn ret, Step step, DueRule rule, LocalDate lastDue, LocalDate today) {
        if (rule != null && rule.kind() == DueRule.Kind.OFFSET && step.unit() == Unit.MONTH) {
            int days = rule.daysAfterPeriodEnd();
            YearMonth periodEnd = lastDue == null
                ? alignToCycle(YearMonth.from(today.minusDays(days)), step.amount())
                : YearMonth.from(lastDue.minusDays(days)).plusMonths(step.amount());
            LocalDate due = periodEnd.atEndOfMonth().plusDays(days);
            return new Occurrence(YearMonth.from(due).toString(), due);
        }
        LocalDate cursor;
        if (rule != null && rule.kind() == DueRule.Kind.DATE) {
            boolean explicit = DueRule.SOURCE_USER.equals(ret.getDueDateSource());
            long k = lastDue == null
                ? (explicit ? 0 : firstCycleIndex(rule.firstDueDate(), step, today))
                : cycleIndex(rule.firstDueDate(), step, lastDue) + 1;
            cursor = nthCycleDate(rule.firstDueDate(), step, k);
        } else {
            cursor = lastDue == null ? today : advance(lastDue, step);
        }
        return new Occurrence(labelOf(cursor, step), dueOf(ret, cursor, step));
    }

    static List<Occurrence> project(RegulatoryReturn ret, Step step, DueRule rule, LocalDate lastDue,
                                    LocalDate today, int count) {
        List<Occurrence> out = new ArrayList<>();
        LocalDate cursor = lastDue;
        for (int i = 0; i < count; i++) {
            Occurrence o = next(ret, step, rule, cursor, today);
            out.add(o);
            cursor = o.due();
        }
        return out;
    }

    static YearMonth alignToCycle(YearMonth ym, int stepMonths) {
        YearMonth aligned = ym;
        for (int i = 0; i < 12; i++) {
            if (aligned.getMonthValue() % stepMonths == 0) return aligned;
            aligned = aligned.plusMonths(1);
        }
        return aligned;
    }

    static String labelOf(LocalDate cursor, Step step) {
        return switch (step.unit()) {
            case DAY  -> cursor.toString();
            case WEEK -> cursor.get(IsoFields.WEEK_BASED_YEAR) + "-W"
                + String.format("%02d", cursor.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
            case MONTH -> YearMonth.from(cursor).toString();
        };
    }

    static LocalDate dueOf(RegulatoryReturn ret, LocalDate cursor, Step step) {
        if (step.unit() != Unit.MONTH) return cursor;
        int day = ret.getFilingDate() != null
            ? Math.min(ret.getFilingDate().getDayOfMonth(), cursor.lengthOfMonth())
            : cursor.getDayOfMonth();
        return cursor.withDayOfMonth(day);
    }

    static LocalDate advance(LocalDate date, Step step) {
        return switch (step.unit()) {
            case DAY   -> date.plusDays(step.amount());
            case WEEK  -> date.plusWeeks(step.amount());
            case MONTH -> date.plusMonths(step.amount());
        };
    }

    static LocalDate nthCycleDate(LocalDate anchor, Step step, long n) {
        return switch (step.unit()) {
            case DAY   -> anchor.plusDays(n * step.amount());
            case WEEK  -> anchor.plusWeeks(n * step.amount());
            case MONTH -> anchor.plusMonths(n * step.amount());
        };
    }

    static long firstCycleIndex(LocalDate anchor, Step step, LocalDate today) {
        if (!anchor.isBefore(today)) return 0;
        long stepDays = switch (step.unit()) {
            case DAY -> step.amount();
            case WEEK -> 7L * step.amount();
            case MONTH -> 0;
        };
        if (stepDays > 0) {
            long days = ChronoUnit.DAYS.between(anchor, today);
            return (days + stepDays - 1) / stepDays;
        }
        long k = Math.max(1, ChronoUnit.MONTHS.between(anchor, today) / step.amount());
        while (nthCycleDate(anchor, step, k).isBefore(today)) k++;
        return k;
    }

    static long cycleIndex(LocalDate anchor, Step step, LocalDate due) {
        long stepDays = switch (step.unit()) {
            case DAY -> step.amount();
            case WEEK -> 7L * step.amount();
            case MONTH -> 0;
        };
        if (stepDays > 0) return Math.max(0, ChronoUnit.DAYS.between(anchor, due) / stepDays);
        return Math.max(0, ChronoUnit.MONTHS.between(anchor, due) / step.amount());
    }
}
