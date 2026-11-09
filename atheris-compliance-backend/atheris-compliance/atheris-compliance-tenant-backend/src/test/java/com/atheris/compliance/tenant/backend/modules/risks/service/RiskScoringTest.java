package com.atheris.compliance.tenant.backend.modules.risks.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.risks.entity.Risk;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RiskScoringTest {

    private static Obligation ob(String likelihood, String impact) {
        return Obligation.builder().inherentLikelihood(likelihood).inherentImpact(impact).build();
    }

    @Test
    void riskTakesTheWorstLikelihoodAndImpactOfTheObligationsItCovers() {
        Risk risk = Risk.builder().riskCode("AML-04").name("KYC failure").build();
        RiskScoring.apply(risk, List.of(ob("Low", "Medium"), ob("High", "Low"), ob("Medium", "High")));
        assertEquals("High", risk.getInherentLikelihood());
        assertEquals("High", risk.getInherentImpact());
        assertEquals("High", risk.getInherentBand());
    }

    @Test
    void riskWithNoRatedObligationsIsUnratedNotLow() {
        Risk risk = Risk.builder().riskCode("X").name("x").build();
        RiskScoring.apply(risk, List.of(ob(null, null)));
        assertNull(risk.getInherentLikelihood());
        assertEquals("Unrated", risk.getInherentBand());
    }

    @Test
    void riskWithNoObligationsIsUnrated() {
        Risk risk = Risk.builder().riskCode("X").name("x").build();
        RiskScoring.apply(risk, List.of());
        assertEquals("Unrated", risk.getInherentBand());
    }
}
