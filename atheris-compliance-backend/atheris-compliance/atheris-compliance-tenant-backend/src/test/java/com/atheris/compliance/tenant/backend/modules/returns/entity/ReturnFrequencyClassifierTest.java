package com.atheris.compliance.tenant.backend.modules.returns.entity;

import com.atheris.compliance.common.returns.ReturnFrequencyClassifier;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReturnFrequencyClassifierTest {

    @Test
    void periodEndAnchoredDeadlinesArePeriodicNotEvent() {
        assertEquals(Optional.of(ReturnFrequencyClassifier.ANNUAL),
            ReturnFrequencyClassifier.classify("Within 3 months after year-end"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.ANNUAL),
            ReturnFrequencyClassifier.classify("Within 1 month after Financial year (FY) end"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.ANNUAL),
            ReturnFrequencyClassifier.classify("Not later than 90 days after year-end"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.QUARTERLY),
            ReturnFrequencyClassifier.classify("Within 14 days after each calendar quarter;"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.QUARTERLY),
            ReturnFrequencyClassifier.classify("Not later than 30 days after quarter-end"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.MONTHLY),
            ReturnFrequencyClassifier.classify("Monthly - Not later than the 14th day of the following month"));
    }

    @Test
    void occurrenceAnchoredDeadlinesAreEventDriven() {
        assertEquals(Optional.of(ReturnFrequencyClassifier.EVENT_DRIVEN),
            ReturnFrequencyClassifier.classify("Within 30 days of receipt"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.EVENT_DRIVEN),
            ReturnFrequencyClassifier.classify("Within 72 hours of becoming aware of the breach"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.EVENT_DRIVEN),
            ReturnFrequencyClassifier.classify("Within 24 hours of the transaction"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.EVENT_DRIVEN),
            ReturnFrequencyClassifier.classify("Within 1 year of the incident"));
    }

    @Test
    void fixedDateAndCycleWordDeadlines() {
        assertEquals(Optional.of(ReturnFrequencyClassifier.ANNUAL),
            ReturnFrequencyClassifier.classify("Annually by June 30"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.ANNUAL),
            ReturnFrequencyClassifier.classify("By March 15 of the following year"));
        assertEquals(Optional.of(ReturnFrequencyClassifier.SEMI_ANNUAL),
            ReturnFrequencyClassifier.classify("Twice yearly: by 7th January and 7th July"));
    }
}
