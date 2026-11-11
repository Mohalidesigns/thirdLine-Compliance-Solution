package com.atheris.compliance.tenant.backend.modules.risks.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RiskResidualTest {

    private static final Map<Integer, String> RESULTS = Map.of(
        1, "Passed", 2, "Passed", 3, "Passed", 4, "Failed", 5, "Partial");

    @Test
    void allControlsPassedLowersLikelihoodByTwoSteps() {
        RiskResidual.Result r = RiskResidual.compute("Likely", "Major", List.of(1, 2, 3), RESULTS);
        assertEquals("Unlikely", r.likelihood());
        assertEquals("Major", r.impact());
        assertEquals("Moderate", r.band());
    }

    @Test
    void majorityPassedLowersLikelihoodByOneStep() {
        RiskResidual.Result r = RiskResidual.compute("Almost Certain", "Major", List.of(1, 2, 5), RESULTS);
        assertEquals("Likely", r.likelihood());
        assertEquals("Major", r.impact());
        assertEquals("High", r.band());
    }

    @Test
    void noControlPassedHoldsLikelihoodAtInherent() {
        RiskResidual.Result r = RiskResidual.compute("Likely", "Major", List.of(4, 5), RESULTS);
        assertEquals("Likely", r.likelihood());
        assertEquals("High", r.band());
    }

    @Test
    void noControlLinkedResidualEqualsInherent() {
        RiskResidual.Result r = RiskResidual.compute("Possible", "Moderate", List.of(), RESULTS);
        assertEquals("Possible", r.likelihood());
        assertEquals("Moderate", r.band());
    }

    @Test
    void unratedRiskHasNoResidual() {
        RiskResidual.Result r = RiskResidual.compute(null, null, List.of(1), RESULTS);
        assertNull(r.band());
    }

    @Test
    void likelihoodNeverFallsBelowRare() {
        RiskResidual.Result r = RiskResidual.compute("Rare", "Severe", List.of(1, 2, 3), RESULTS);
        assertEquals("Rare", r.likelihood());
        assertEquals("Low", r.band());
    }
}