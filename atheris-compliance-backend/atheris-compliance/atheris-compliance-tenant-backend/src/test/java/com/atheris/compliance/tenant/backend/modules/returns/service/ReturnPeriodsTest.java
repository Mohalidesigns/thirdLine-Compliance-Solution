package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReturnPeriodsTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 25);

    private static RegulatoryReturn ret(String frequencyType, LocalDate filingDate, Integer daysAfterPeriodEnd) {
        return RegulatoryReturn.builder()
            .returnName("test").frequencyType(frequencyType)
            .filingDate(filingDate).dueDaysAfterPeriodEnd(daysAfterPeriodEnd)
            .build();
    }

    private static ReturnPeriods.Occurrence next(RegulatoryReturn r, LocalDate lastDue) {
        ReturnPeriods.Step step = ReturnPeriods.stepFor(r.getFrequencyType());
        return ReturnPeriods.next(r, step, DueRule.of(r), lastDue, TODAY);
    }

    @Test
    void monthlyOffsetStartsAtTheCurrentPeriodAndRollsFromTheDueDate() {
        RegulatoryReturn r = ret("MONTHLY", null, 15);
        ReturnPeriods.Occurrence first = next(r, null);
        assertEquals(LocalDate.of(2026, 11, 15), first.due());
        assertEquals("2026-11", first.period());

        ReturnPeriods.Occurrence second = next(r, first.due());
        assertEquals(LocalDate.of(2026, 12, 15), second.due());
    }

    @Test
    void quarterlyOffsetAlignsToCycleMonths() {
        RegulatoryReturn r = ret("QUARTERLY", null, 30);
        ReturnPeriods.Occurrence first = next(r, null);
        assertEquals(LocalDate.of(2026, 10, 30), first.due());

        ReturnPeriods.Occurrence second = next(r, first.due());
        assertEquals(LocalDate.of(2027, 1, 30), second.due());
    }

    @Test
    void annualOffsetUsesTheYearEnd() {
        RegulatoryReturn r = ret("ANNUAL", null, 90);
        assertEquals(LocalDate.of(2027, 3, 31), next(r, null).due());
    }

    @Test
    void dateRuleRidesTheAnchorCycle() {
        RegulatoryReturn r = ret("ANNUAL", LocalDate.of(2027, 6, 30), null);
        ReturnPeriods.Occurrence first = next(r, null);
        assertEquals(LocalDate.of(2027, 6, 30), first.due());
        assertEquals("2027-06", first.period());
        assertEquals(LocalDate.of(2028, 6, 30), next(r, first.due()).due());
    }

    @Test
    void ruleLessDailyAndWeeklyAdvanceFromToday() {
        ReturnPeriods.Occurrence daily = next(ret("DAILY", null, null), null);
        assertEquals(TODAY, daily.due());
        assertEquals("2026-10-25", daily.period());
        assertEquals(TODAY.plusDays(1), next(ret("DAILY", null, null), daily.due()).due());

        ReturnPeriods.Occurrence weekly = next(ret("WEEKLY", null, null), null);
        assertEquals(TODAY.plusWeeks(1), next(ret("WEEKLY", null, null), weekly.due()).due());
    }

    @Test
    void projectionMatchesWhatGenerationWouldCreate() {
        RegulatoryReturn r = ret("MONTHLY", null, 10);
        ReturnPeriods.Step step = ReturnPeriods.stepFor(r.getFrequencyType());
        DueRule rule = DueRule.of(r);

        List<ReturnPeriods.Occurrence> projected = ReturnPeriods.project(r, step, rule, null, TODAY, 3);
        assertEquals(3, projected.size());

        ReturnPeriods.Occurrence generated = ReturnPeriods.next(r, step, rule, null, TODAY);
        assertEquals(projected.get(0), generated);
        assertEquals(projected.get(1), ReturnPeriods.next(r, step, rule, generated.due(), TODAY));

        for (int i = 1; i < projected.size(); i++) {
            assertTrue(projected.get(i).due().isAfter(projected.get(i - 1).due()));
        }
    }

    @Test
    void eventDrivenReturnsHaveNoStep() {
        assertEquals(null, ReturnPeriods.stepFor("EVENT_DRIVEN"));
    }
}
