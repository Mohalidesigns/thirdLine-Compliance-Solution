package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.risk.service.ResidualRule;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ObligationResidualTest {

    private static final Map<Integer, String> RESULTS = Map.of(
        1, "Passed", 2, "Passed", 3, "Passed", 4, "Failed", 5, "Partial");

    @Test
    void allControlsPassedLowersLikelihoodByTwoSteps() {
        ObligationResidual.Result r = ObligationResidual.compute("Major", "Likely", List.of(1, 2, 3), RESULTS);
        assertEquals("Unlikely", r.likelihood());
        assertEquals("Major", r.impact());
        assertEquals("Moderate", r.band());
    }

    @Test
    void majorityPassedLowersLikelihoodByOneStep() {
        ObligationResidual.Result r = ObligationResidual.compute("Major", "Almost Certain", List.of(1, 2, 5), RESULTS);
        assertEquals("Likely", r.likelihood());
        assertEquals("Major", r.impact());
        assertEquals("High", r.band());
    }

    @Test
    void noControlPassedHoldsLikelihoodAtInherent() {
        ObligationResidual.Result r = ObligationResidual.compute("Major", "Likely", List.of(4, 5), RESULTS);
        assertEquals("Likely", r.likelihood());
        assertEquals("High", r.band());
    }

    @Test
    void noControlLinkedResidualEqualsInherent() {
        ObligationResidual.Result r = ObligationResidual.compute("Moderate", "Possible", List.of(), RESULTS);
        assertEquals("Possible", r.likelihood());
        assertEquals("Moderate", r.band());
    }

    @Test
    void unratedRiskHasNoResidual() {
        ObligationResidual.Result r = ObligationResidual.compute(null, null, List.of(1), RESULTS);
        assertNull(r.band());
    }

    @Test
    void likelihoodNeverFallsBelowRare() {
        ObligationResidual.Result r = ObligationResidual.compute("Severe", "Rare", List.of(1, 2, 3), RESULTS);
        assertEquals("Rare", r.likelihood());
        assertEquals("Low", r.band());
    }

    @Test
    void customAllDropUsesConfiguredValue() {
        ResidualRule rule = new ResidualRule(4, 1, ResidualRule.Axis.LIKELIHOOD, "Passed", 1);
        ObligationResidual.Result r = ObligationResidual.compute("Major", "Likely", List.of(1, 2, 3), RESULTS, rule);
        assertEquals("Rare", r.likelihood());
        assertEquals("Low", r.band());
    }

    @Test
    void axisImpactLowersImpactNotLikelihood() {
        ResidualRule rule = new ResidualRule(2, 1, ResidualRule.Axis.IMPACT, "Passed", 1);
        ObligationResidual.Result r = ObligationResidual.compute("Major", "Likely", List.of(1, 2, 3), RESULTS, rule);
        assertEquals("Likely", r.likelihood());
        assertEquals("Minor", r.impact());
    }

    @Test
    void axisBothLowersBothAxes() {
        ResidualRule rule = new ResidualRule(2, 1, ResidualRule.Axis.BOTH, "Passed", 1);
        ObligationResidual.Result r = ObligationResidual.compute("Major", "Likely", List.of(1, 2, 3), RESULTS, rule);
        assertEquals("Unlikely", r.likelihood());
        assertEquals("Minor", r.impact());
    }

    @Test
    void lenientTargetCountsPartialAsEffective() {
        ResidualRule rule = new ResidualRule(2, 1, ResidualRule.Axis.LIKELIHOOD, "PassedOrPartial", 1);
        ObligationResidual.Result r = ObligationResidual.compute("Major", "Likely", List.of(1, 5), RESULTS, rule);
        assertEquals("Unlikely", r.likelihood());
    }

    @Test
    void customFloorClampsTheDrop() {
        ResidualRule rule = new ResidualRule(4, 1, ResidualRule.Axis.LIKELIHOOD, "Passed", 3);
        ObligationResidual.Result r = ObligationResidual.compute("Major", "Likely", List.of(1, 2, 3), RESULTS, rule);
        assertEquals("Possible", r.likelihood());
    }
}