package com.atheris.compliance.tenant.backend.shared.util;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BandThresholdsTest {

    @AfterEach
    void reset() {
        BandThresholds.reset();
    }

    @Test
    void defaultThresholdsMatchTheStandardBands() {
        assertEquals("Critical", BandThresholds.band(20));
        assertEquals("High", BandThresholds.band(16));
        assertEquals("Moderate", BandThresholds.band(8));
        assertEquals("Low", BandThresholds.band(4));
    }

    @Test
    void customThresholdsReBand() {
        BandThresholds.apply(6, 20, 24);
        assertEquals("Moderate", BandThresholds.band(16));
        assertEquals("High", BandThresholds.band(21));
        assertEquals("Critical", BandThresholds.band(25));
    }

    @Test
    void bandByLabelsUsesTheConfiguredThresholds() {
        BandThresholds.apply(3, 6, 12);
        assertEquals("Moderate", BandThresholds.bandByLabels("Rare", "Moderate"));
        assertEquals("High", BandThresholds.bandByLabels("Unlikely", "Moderate"));
    }

    @Test
    void invalidThresholdsFallBackToDefaults() {
        BandThresholds.apply(0, null, -5);
        assertEquals("Moderate", BandThresholds.band(8));
    }
}