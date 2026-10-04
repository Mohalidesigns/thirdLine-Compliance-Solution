package com.atheris.compliance.tenant.backend.modules.returns.entity;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Real platform frequency texts → expected type. */
class ReturnFrequencyTest {

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource(delimiter = '|', textBlock = """
        Annually, not later than February 28                        | ANNUAL
        Annually or upon renewal                                    | ANNUAL
        Annually: Within 7 days of each declaration anniversary     | ANNUAL
        Annually for 2 years post-exit (within 7 days of anniversary) | ANNUAL
        Annually Within 60 days of Board approval                   | ANNUAL
        Monthly – Not later than the 10th day of the following month | MONTHLY
        Monthly – not later than the 5th working day of the following month | MONTHLY
        Daily + Within 10 minutes for RFQ uploads                   | DAILY
        Within 14 days after each calendar quarter;                 | QUARTERLY
        Within six (6) months after the end of the financial year.  | ANNUAL
        Within 1 month after Financial year (FY) end                | ANNUAL
        Not later than 90 days after year-end                       | ANNUAL
        Not later than 30 days after quarter-end                    | QUARTERLY
        Within 1 year of the incident                               | EVENT_DRIVEN
        Within 3 years of the incident                              | EVENT_DRIVEN
        Within 3 months of guideline issue                          | EVENT_DRIVEN
        Within 14 days of appointment                               | EVENT_DRIVEN
        Immediately / Without delay                                 | EVENT_DRIVEN
        Within 30 days after month-end                              | MONTHLY
        Semi-annually                                               | SEMI_ANNUAL
        Bi-annual, within 30 days                                   | SEMI_ANNUAL
        Half-yearly                                                 | SEMI_ANNUAL
        Biennial                                                    | BIENNIAL
        Solo Basis: Monthly (5 days after month-end) Consolidated Basis: Quarterly (5 days after quarter-end) Immediately if LCR falls below 100% | MONTHLY
        Continuous / Annual                                         | ANNUAL
        Continuous (retain for 3 years)                             | EVENT_DRIVEN
        Twice yearly: by 7th January and 7th July                   | SEMI_ANNUAL
        Biannual                                                    | SEMI_ANNUAL
        Biannual Staff Movement Return                              | SEMI_ANNUAL
        Bi-annually, by 31st January and 31st July                  | SEMI_ANNUAL
        Twice a year                                                | SEMI_ANNUAL
        Twice annually, within 30 days of half-year end             | SEMI_ANNUAL
        Two times a year                                            | SEMI_ANNUAL
        Every six (6) months                                        | SEMI_ANNUAL
        Every 6 months from the date of licence                     | SEMI_ANNUAL
        Half-yearly, not later than 31st July                       | SEMI_ANNUAL
        Biennially                                                  | BIENNIAL
        Annually                                                    | ANNUAL
        Yearly                                                      | ANNUAL
        """)
    void classifiesPlatformTexts(String text, ReturnFrequency expected) {
        assertEquals(Optional.of(expected), ReturnFrequency.classify(text));
    }
}
