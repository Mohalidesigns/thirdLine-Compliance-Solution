package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Items 6, 7, 8: area, act and risk repaired on seeded obligations; user edits kept. */
class SeedDataRepairServiceTest {

    private static final Map<Long, SeedDataRepairService.InstrumentContext> CONTEXT = Map.of(
        10L, new SeedDataRepairService.InstrumentContext(501L, "Money Laundering (Prevention and Prohibition) Act, 2022", "AML/CFT/CPF"),
        20L, new SeedDataRepairService.InstrumentContext(502L, "NDPA GAID 2025", null));

    private static Obligation obligation(long id, long instrumentId, String area, String rating) {
        return Obligation.builder().obligationId(id).instrumentId(instrumentId).source("seeded")
            .areaOfFocus(area).inherentLikelihood("Medium").inherentImpact("High").inherentRiskRating(rating).build();
    }

    private static ObligationClassification classification(long obligationId, String tenantRating) {
        return ObligationClassification.builder().obligationId(obligationId)
            .likelihoodRating("Medium").impactRating("High").tenantRiskRating(tenantRating).build();
    }

    @Test
    void linksActInheritsAreaAndRebandsUntouchedRisk() {
        Obligation a = obligation(1, 10, "Compliance Risk Management", "Critical");
        Obligation b = obligation(2, 20, "Data Protection", "Critical");
        ObligationClassification ca = classification(1, "Critical");
        ObligationClassification cb = classification(2, "Critical");

        SeedDataRepairService.Result r = SeedDataRepairService.apply(List.of(a, b), Map.of(1L, ca, 2L, cb), CONTEXT);

        assertEquals("Money Laundering (Prevention and Prohibition) Act, 2022", a.getActName());
        assertEquals(501L, a.getRegulationId());
        assertEquals("AML/CFT/CPF", a.getAreaOfFocus(), "inherited from the instrument");
        assertEquals("Data Protection", b.getAreaOfFocus(), "instrument has no area: own area kept");
        assertEquals("High", a.getInherentRiskRating(), "Medium x High = 12 is High, not Critical");
        assertEquals("High", ca.getTenantRiskRating());
        assertEquals("High", ca.getInherentRiskRating(), "classification band computed from its ratings");
        assertEquals(2, r.actLinked());
        assertEquals(1, r.areaReassigned());
        assertEquals(2, r.riskRebanded());
        assertEquals(2, r.classificationsUpdated());
    }

    @Test
    void aRatingTheUserChangedIsKept() {
        Obligation a = obligation(1, 10, "AML/CFT/CPF", "Critical");
        ObligationClassification ca = classification(1, "Moderate");   // set by a user, not the old seed band

        SeedDataRepairService.apply(List.of(a), Map.of(1L, ca), CONTEXT);

        assertEquals("Moderate", ca.getTenantRiskRating());
    }

    @Test
    void secondRunChangesNothing() {
        Obligation a = obligation(1, 10, "Compliance Risk Management", "Critical");
        ObligationClassification ca = classification(1, "Critical");
        SeedDataRepairService.apply(List.of(a), Map.of(1L, ca), CONTEXT);

        SeedDataRepairService.Result again = SeedDataRepairService.apply(List.of(a), Map.of(1L, ca), CONTEXT);

        assertEquals(new SeedDataRepairService.Result(0, 0, 0, 0), again);
    }

    @Test
    void contextIsBuiltFromTheCanonicalInstrumentOfEachBundle() {
        PlatformRegulationSeed bundle = PlatformRegulationSeed.builder()
            .regulationId(7L).regulationName("BOFIA 2020")
            .canonicalInstrument(PlatformRegulationSeed.InstrumentItem.builder().instrumentId(99L).areaOfFocus("Corporate Governance").build())
            .build();
        Map<Long, SeedDataRepairService.InstrumentContext> ctx = SeedDataRepairService.contextByInstrument(List.of(bundle));
        assertEquals(new SeedDataRepairService.InstrumentContext(7L, "BOFIA 2020", "Corporate Governance"), ctx.get(99L));
    }
}
