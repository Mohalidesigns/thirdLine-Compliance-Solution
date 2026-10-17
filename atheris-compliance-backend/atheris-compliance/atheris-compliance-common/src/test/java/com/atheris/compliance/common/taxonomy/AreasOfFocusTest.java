package com.atheris.compliance.common.taxonomy;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AreasOfFocusTest {

    @Test
    void obligationInheritsTheInstrumentArea() {
        assertEquals("AML/CFT/CPF", AreasOfFocus.forObligation("AML/CFT/CPF", "Compliance Risk Management"));
        assertEquals("Risk Management", AreasOfFocus.forObligation("Risk Management", "Corporate Governance"));
    }

    @Test
    void withoutAnInstrumentAreaTheSectionAreaIsMappedOntoUniverseNames() {
        assertEquals("AML/CFT/CPF", AreasOfFocus.forObligation(null, "AML/CFT"));
        assertEquals("People and Conduct Risk", AreasOfFocus.forObligation("", "Conduct Risk"));
        assertEquals("Capital Market Operations", AreasOfFocus.forObligation(null, "Capital Market"));
        assertEquals("Data Protection", AreasOfFocus.forObligation(null, "Data Protection"));
    }

    @Test
    void theGenericCrmpSheetIsNeverAnArea() {
        assertNull(AreasOfFocus.forObligation(null, "Compliance Risk Management"));
        assertEquals("Unassigned", AreasOfFocus.bucket("Compliance Risk Management"));
        assertEquals("Unassigned", AreasOfFocus.bucket(null));
    }

    @Test
    void ruleIsIdempotent() {
        String once = AreasOfFocus.forObligation(null, "Conduct Risk");
        assertEquals(once, AreasOfFocus.forObligation(null, once));
        assertEquals("Financial Reporting", AreasOfFocus.canonical("Financial reporting"));
    }
}
