package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ComplianceMetricsServiceScoreTest {

    private final ComplianceMetricsService service = new ComplianceMetricsService(
        null, null, null, null, null, null, null, null);

    private Map<String, Integer> weights() {
        Map<String, Integer> w = new LinkedHashMap<>();
        w.put("controlCoverage", 30);
        w.put("controlTests", 25);
        w.put("returnsOnTime", 30);
        w.put("findingsWithinSla", 15);
        return w;
    }

    @Test
    void perfectScoresGive100() {
        Map<String, Double> c = Map.of(
            "controlCoverage", 100.0, "controlTests", 100.0,
            "returnsOnTime", 100.0, "findingsWithinSla", 100.0);
        Map<String, Boolean> d = Map.of(
            "controlCoverage", true, "controlTests", true,
            "returnsOnTime", true, "findingsWithinSla", true);
        assertEquals(100.0, service.computeScore(c, weights(), d));
    }

    @Test
    void zeroScoresGiveZero() {
        Map<String, Double> c = Map.of(
            "controlCoverage", 0.0, "controlTests", 0.0,
            "returnsOnTime", 0.0, "findingsWithinSla", 0.0);
        Map<String, Boolean> d = Map.of(
            "controlCoverage", true, "controlTests", true,
            "returnsOnTime", true, "findingsWithinSla", true);
        assertEquals(0.0, service.computeScore(c, weights(), d));
    }

    @Test
    void weightedBlendOfComponents() {
        // 30%*50 + 25%*0 + 30%*100 + 15%*0 = 15 + 0 + 30 + 0 = 45
        Map<String, Double> c = Map.of(
            "controlCoverage", 50.0, "controlTests", 0.0,
            "returnsOnTime", 100.0, "findingsWithinSla", 0.0);
        Map<String, Boolean> d = Map.of(
            "controlCoverage", true, "controlTests", true,
            "returnsOnTime", true, "findingsWithinSla", true);
        assertEquals(45.0, service.computeScore(c, weights(), d));
    }

    @Test
    void missingComponentRenormalisesWeights() {
        // Only controlCoverage has data and it scores 80 -> score is 80 regardless of its weight.
        Map<String, Double> c = Map.of(
            "controlCoverage", 80.0, "controlTests", 0.0,
            "returnsOnTime", 0.0, "findingsWithinSla", 0.0);
        Map<String, Boolean> d = Map.of(
            "controlCoverage", true, "controlTests", false,
            "returnsOnTime", false, "findingsWithinSla", false);
        assertEquals(80.0, service.computeScore(c, weights(), d));
    }

    @Test
    void noDataAtAllGivesNull() {
        Map<String, Double> c = Map.of(
            "controlCoverage", 0.0, "controlTests", 0.0,
            "returnsOnTime", 0.0, "findingsWithinSla", 0.0);
        Map<String, Boolean> d = Map.of(
            "controlCoverage", false, "controlTests", false,
            "returnsOnTime", false, "findingsWithinSla", false);
        assertNull(service.computeScore(c, weights(), d));
    }

    @Test
    void scoreNeverGoesBelowZeroEvenWithGarbageInput() {
        Map<String, Double> c = Map.of(
            "controlCoverage", 10.0, "controlTests", 5.0,
            "returnsOnTime", 0.0, "findingsWithinSla", 0.0);
        Map<String, Boolean> d = Map.of(
            "controlCoverage", true, "controlTests", true,
            "returnsOnTime", false, "findingsWithinSla", false);
        double s = service.computeScore(c, weights(), d);
        assertTrue(s >= 0 && s <= 100, "score must be within 0..100, was " + s);
    }
}