package com.atheris.compliance.common.obligations;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ObligationKeyTest {

    @Test
    void crossSheetCopiesShareAKey() {
        String verbatim = "A Financial Institution shall: (a) identify the customer…";
        // same row on the crmp sheet and the amlcft sheet: interpretation reworded, section labelled
        assertEquals(
            ObligationKey.of("Failure to Complete CDD", "24", verbatim, "The Bank must:"),
            ObligationKey.of("Failure to complete CDD", "Section 24", verbatim, "The Bank shall:"));
    }

    @Test
    void differentTitleOrTextIsADifferentObligation() {
        assertNotEquals(ObligationKey.of("A", "1", "text", null), ObligationKey.of("B", "1", "text", null));
        assertNotEquals(ObligationKey.of("A", "1", "text one", null), ObligationKey.of("A", "1", "text two", null));
        assertNotEquals(ObligationKey.of("A", "1", "text", null), ObligationKey.of("A", "10", "text", null));
    }

    @Test
    void interpretedTextOnlyWhenNoVerbatimAndNullWithoutText() {
        assertEquals(ObligationKey.of("A", "1", "", "plain"), ObligationKey.of("A", "1", null, "Plain."));
        assertNull(ObligationKey.of("A", "1", " ", null));
    }
}
