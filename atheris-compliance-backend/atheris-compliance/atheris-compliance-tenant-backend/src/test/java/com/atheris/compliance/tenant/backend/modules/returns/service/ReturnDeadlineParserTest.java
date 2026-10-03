package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFrequency;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Real platform deadline texts → expected rule. Expected: {@code A m/d} (calendar anchor), {@code O n}
 * (n days after period end) or {@code none}.
 */
class ReturnDeadlineParserTest {

    @ParameterizedTest(name = "[{1}] {0} -> {2}")
    @CsvSource(delimiter = '|', textBlock = """
        Annually (by end of April)                                     | ANNUAL      | A 4/30
        Annually, not later than February 28                           | ANNUAL      | A 2/28
        Annually (by March 31 or 15 months after establishment)        | ANNUAL      | A 3/31
        Annually by June 30                                            | ANNUAL      | A 6/30
        By March 15 of the following year                              | ANNUAL      | A 3/15
        Within 3 months after year-end                                 | ANNUAL      | A 3/31
        Not later than 90 days after year-end                          | ANNUAL      | O 90
        Within 1 month after Financial year (FY) end                   | ANNUAL      | A 1/31
        Annually (End of Financial Year)                               | ANNUAL      | A 12/31
        Entity: Monthly (5 days after month-end) Consolidated: Quarterly (5 days after quarter-end) | MONTHLY | O 5
        Within 5 days after month-end                                  | MONTHLY     | O 5
        Monthly – Not later than the 10th day of the following month   | MONTHLY     | O 10
        Monthly, on or before the 5th day                              | MONTHLY     | O 5
        Not later than 30 days after quarter-end                       | QUARTERLY   | O 30
        Within 14 days after each calendar quarter                     | QUARTERLY   | O 14
        Quarterly – on or before 5th of January, April, July, and October | QUARTERLY | A 1/5
        by the 14th of January, April, July, and October               | QUARTERLY   | A 1/14
        Twice yearly: by 7th January and 7th July                      | SEMI_ANNUAL | A 1/7
        42 days after AGM                                              | ANNUAL      | none
        Annually: within 7 days of each declaration anniversary        | ANNUAL      | none
        Annually                                                       | ANNUAL      | none
        Monthly                                                        | MONTHLY     | none
        Monthly, on or before 5th                                      | MONTHLY     | O 5
        on or before the 15th of each month                            | MONTHLY     | O 15
        by the 10th                                                    | MONTHLY     | O 10
        Monthly, not later than the 7th of every month                 | MONTHLY     | O 7
        Monthly, with each return                                      | MONTHLY     | none
        on or before the 5th working day                               | MONTHLY     | none
        Monthly, by the 3rd business day of the following month        | MONTHLY     | none
        within 5 days                                                  | MONTHLY     | none
        on or before 30th                                              | MONTHLY     | none
        by the 5th of the same month                                   | MONTHLY     | none
        Monthly, by the 2nd schedule                                   | MONTHLY     | none
        on or before 5th of January, April, July, and October          | MONTHLY     | none
        on or before 5th                                               | QUARTERLY   | none
        """)
    void parses(String text, ReturnFrequency type, String expected) {
        assertEquals(expected, render(ReturnDeadlineParser.parse(text, type)));
    }

    @Test
    void typeFromTextWhenNotGiven() {
        assertEquals("A 3/15", render(ReturnDeadlineParser.parse("By March 15 of the following year", null, null)
            .map(ReturnDeadlineParser.Parsed::rule)));
        assertEquals("O 5", render(ReturnDeadlineParser.parse("Within 5 days after month-end", null, null)
            .map(ReturnDeadlineParser.Parsed::rule)));
    }

    @Test
    void mixedTextUsesTheClauseForTheType() {
        String t = "Entity: Monthly (5 days after month-end) Consolidated: Quarterly (30 days after quarter-end)";
        assertEquals("O 30", render(ReturnDeadlineParser.parse(t, ReturnFrequency.QUARTERLY)));
    }

    @Test
    void listedMonthsMustBeOneCycleApart() {
        assertEquals("none", render(ReturnDeadlineParser.parse(
            "by 7th January and 7th April", ReturnFrequency.SEMI_ANNUAL)));
        assertEquals("none", render(ReturnDeadlineParser.parse(
            "by 31 March and 30 September", ReturnFrequency.ANNUAL)));
    }

    @Test
    void monthlyOffsetIsCappedAt28Days() {
        assertEquals("none", render(ReturnDeadlineParser.parse("Within 30 days after month-end", ReturnFrequency.MONTHLY)));
    }

    @Test
    void periodWordMustMatchType() {
        assertEquals("none", render(ReturnDeadlineParser.parse("Within 30 days after quarter-end", ReturnFrequency.ANNUAL)));
    }

    @Test
    void noRuleForDayBasedOrEventTypes() {
        assertEquals("none", render(ReturnDeadlineParser.parse("Within 5 days after month-end", ReturnFrequency.WEEKLY)));
        assertEquals("none", render(ReturnDeadlineParser.parse("by June 30", ReturnFrequency.EVENT_DRIVEN)));
    }

    @Test
    void statutoryBasisIsTheFallback() {
        var p = ReturnDeadlineParser.parse("Annually", "Section 12: file by June 30 each year", ReturnFrequency.ANNUAL);
        assertTrue(p.isPresent());
        assertTrue(p.get().fromStatutoryBasis());
        assertEquals("A 6/30", render(Optional.of(p.get().rule())));
    }

    @Test
    void statutoryBasisNeverGivesABareDayOfMonth() {
        assertTrue(ReturnDeadlineParser.parse("Monthly", "Section 5, as amended by the 2nd.", ReturnFrequency.MONTHLY).isEmpty());
        var p = ReturnDeadlineParser.parse("Monthly", "Section 5: the 10th day of the following month", ReturnFrequency.MONTHLY);
        assertEquals("O 10", render(p.map(ReturnDeadlineParser.Parsed::rule)));
    }

    @Test
    void anchorsAreInTheCurrentYearAndNeverFeb29() {
        DueRule r = ReturnDeadlineParser.parse("Annually by February 29", ReturnFrequency.ANNUAL).orElseThrow();
        assertEquals(LocalDate.now().getYear(), r.firstDueDate().getYear());
        assertEquals(28, r.firstDueDate().getDayOfMonth());
    }

    @Test
    void canonicalAnchorIsTheFirstOccurrenceInTheCycle() {
        DueRule oct = DueRule.date(LocalDate.of(2026, 10, 5));
        DueRule jan = DueRule.date(LocalDate.of(2027, 1, 5));
        assertEquals(jan.canonical(ReturnFrequency.QUARTERLY), oct.canonical(ReturnFrequency.QUARTERLY));
        assertNotEquals(jan.canonical(ReturnFrequency.ANNUAL), oct.canonical(ReturnFrequency.ANNUAL));
    }

    private static String render(Optional<DueRule> r) {
        if (r.isEmpty()) return "none";
        DueRule d = r.get();
        if (d.kind() == DueRule.Kind.OFFSET) return "O " + d.daysAfterPeriodEnd();
        return "A " + d.firstDueDate().getMonthValue() + "/" + d.firstDueDate().getDayOfMonth();
    }
}
