package com.atheris.compliance.common.risk;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

class RiskBandsTest {

    /** The likelihood × impact pairs actually present in the toolkit seed, on the canonical bands. */
    @ParameterizedTest(name = "{0} x {1} -> {2}")
    @CsvSource(delimiter = '|', textBlock = """
        Medium | High      | High
        High   | High      | High
        Medium | Medium    | Moderate
        Low    | High      | Moderate
        Low    | Medium    | Moderate
        High   | Medium    | High
        High   | Very High | Critical
        Low    | Very High | Moderate
        Medium | Very High | High
        Low    | Low       | Low
        """)
    void toolkitPairs(String likelihood, String impact, String expected) {
        assertEquals(expected, RiskBands.band(likelihood, impact));
    }

    @Test
    void matchesTheTenantRiskMatrixCutOffs() {
        assertEquals("Critical", RiskBands.band("Almost Certain", "Severe"));  // 25
        assertEquals("Critical", RiskBands.band("High", "Very High"));          // 20
        assertEquals("High", RiskBands.band("Very High", "Medium"));           // 15
        assertEquals("High", RiskBands.band("Medium", "High"));                // 12
        assertEquals("Moderate", RiskBands.band("Low", "Medium"));             // 6
        assertEquals("Low", RiskBands.band("Low", "Low"));                     // 4
    }

    @Test
    void canonicalAxesUseTheSameBands() {
        assertEquals("High", RiskBands.band("Possible", "Severe"));     // 15
        assertEquals("Critical", RiskBands.band("Likely", "Severe"));   // 20
        assertEquals("Moderate", RiskBands.band("Possible", "Minor"));  // 6
        assertEquals("Low", RiskBands.band("Rare", "Major"));           // 4
    }

    @Test
    void unknownOrMissingRatingIsNullNeverADefaultBand() {
        assertNull(RiskBands.band(null, "High"));
        assertNull(RiskBands.band("Medium", ""));
        assertNull(RiskBands.band("sometimes", "High"));
    }

    @Test
    void legacyBandReproducesTheOldInflation() {
        // the bug: High impact x Medium likelihood = 12 was Critical
        assertEquals("Critical", RiskBands.legacyToolkitBand("Medium", "High"));
        assertEquals("High", RiskBands.band("Medium", "High"));
    }
}
