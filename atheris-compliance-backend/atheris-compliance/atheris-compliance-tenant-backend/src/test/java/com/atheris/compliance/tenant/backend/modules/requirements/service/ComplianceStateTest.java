package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.atheris.compliance.tenant.backend.modules.requirements.service.ComplianceState.*;
import static org.junit.jupiter.api.Assertions.*;

class ComplianceStateTest {

    private static Requirement req(String override) {
        return Requirement.builder().text("x").stateOverride(override).build();
    }

    private static Map<Integer, String> results(Object... kv) {
        Map<Integer, String> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((Integer) kv[i], (String) kv[i + 1]);
        return m;
    }

    @Test
    void aRequirementNoControlCoversIsAGap() {
        assertEquals(NO_CONTROL, ofRequirement(req(null), List.of(), Map.of()));
        assertEquals(NO_CONTROL, ofRequirement(req(null), null, Map.of()));
        assertTrue(isGap(NO_CONTROL));
        assertFalse(isGap(PARTIAL));
    }

    @Test
    void allControlsEffectiveIsCompliant() {
        assertEquals(COMPLIANT, ofRequirement(req(null), List.of(1, 2), results(1, "Passed", 2, "Passed")));
    }

    @Test
    void someControlsEffectiveIsPartialEvenWhenAnotherFailed() {
        assertEquals(PARTIAL, ofRequirement(req(null), List.of(1, 2), results(1, "Passed", 2, "Failed")));
        assertEquals(PARTIAL, ofRequirement(req(null), List.of(1, 2), results(1, "Passed")));
    }

    @Test
    void aFailedControlWithNothingEffectiveIsNonCompliant() {
        assertEquals(NON_COMPLIANT, ofRequirement(req(null), List.of(1), results(1, "Failed")));
        assertEquals(NON_COMPLIANT, ofRequirement(req(null), List.of(1, 2), results(1, "Failed")));
    }

    @Test
    void untestedControlsAreNotEffectiveButNotAnAccusationEither() {
        assertEquals(PARTIAL, ofRequirement(req(null), List.of(1, 2), Map.of()));
        assertEquals(PARTIAL, ofRequirement(req(null), List.of(1), results(1, "Partial")));
    }

    @Test
    void anExplicitOverrideWinsOverTheDerivedState() {
        assertEquals(COMPLIANT, ofRequirement(req("COMPLIANT"), List.of(), Map.of()));
        assertEquals(NON_COMPLIANT, ofRequirement(req("NON_COMPLIANT"), List.of(1), results(1, "Passed")));
    }

    @Test
    void obligationStateRollsUpWorstFirst() {
        assertEquals(NON_COMPLIANT, ofObligation(List.of(COMPLIANT, NO_CONTROL, NON_COMPLIANT)));
        assertEquals(GAP, ofObligation(List.of(COMPLIANT, NO_CONTROL, PARTIAL)));
        assertEquals(PARTIAL, ofObligation(List.of(COMPLIANT, PARTIAL)));
        assertEquals(COMPLIANT, ofObligation(List.of(COMPLIANT, COMPLIANT)));
        assertEquals(NO_REQUIREMENTS, ofObligation(List.of()));
    }

    @Test
    void anObligationWithOneUncoveredRequirementIsAGapEvenIfTheOthersAreCovered() {
        assertEquals(GAP, ofObligation(List.of(COMPLIANT, COMPLIANT, NO_CONTROL)));
    }
}
