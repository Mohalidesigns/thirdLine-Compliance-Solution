package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** O1 merge rules and O2/C2 platform → tenant link translation. */
class SeedLinkRepairServiceTest {

    private static Obligation ob(long id, String plain, String section) {
        return Obligation.builder().obligationId(id).instrumentId(10L).title("Failure to Complete CDD")
            .sectionReference(section).description("A FI shall identify…").plainEnglishStatement(plain).source("seeded").build();
    }

    private static ObligationClassification cls(long obligationId, int version) {
        return ObligationClassification.builder().obligationId(obligationId).classificationVersion(version).build();
    }

    @Test
    void keeperIsTheEditedRowThenThePlatformCopyThenTheLowestId() {
        Obligation a = ob(323, "The Bank must:", "24");
        Obligation b = ob(361, "The Bank shall:", "Section 24");
        Set<String> platform = Set.of("10#the bank shall|24");
        // nobody edited either: the copy the platform kept
        assertSame(b, SeedLinkRepairService.chooseKeeper(List.of(a, b), Map.of(323L, cls(323, 1), 361L, cls(361, 1)), Set.of(), platform));
        // one was edited: keep it
        assertSame(a, SeedLinkRepairService.chooseKeeper(List.of(a, b), Map.of(323L, cls(323, 4), 361L, cls(361, 1)), Set.of(), platform));
        assertSame(a, SeedLinkRepairService.chooseKeeper(List.of(a, b), Map.of(), Set.of(323L), platform));
        // both edited: leave for a person
        assertNull(SeedLinkRepairService.chooseKeeper(List.of(a, b), Map.of(323L, cls(323, 2), 361L, cls(361, 3)), Set.of(), platform));
        // no platform match: lowest id
        assertSame(a, SeedLinkRepairService.chooseKeeper(List.of(b, a), Map.of(), Set.of(), Set.of()));
    }

    @Test
    void mergedIdsAreReplacedOnce() {
        assertEquals(List.of(1L, 361L, 5L), SeedLinkRepairService.replaceIds(List.of(1L, 323L, 361L, 5L), Map.of(323L, 361L)));
        assertNull(SeedLinkRepairService.replaceIds(List.of(1L, 2L), Map.of(323L, 361L)));
    }

    @Test
    void platformIdsTranslateToTenantIdsAndUnknownOnesAreDropped() {
        List<PlatformRegulationSeed.ObligationItem> items = List.of(
            PlatformRegulationSeed.ObligationItem.builder().obligationId(1776L).title("Failure to Complete CDD")
                .specificSectionReference("24").description("A FI shall identify…").plainEnglishStatement("x").build());
        Map<Long, Long> p2t = SeedLinks.platformToTenant(items, List.of(ob(361, "y", "Section 24")));
        assertEquals(Map.of(1776L, 361L), p2t);
        assertEquals(List.of(361L), SeedLinks.translate("1776, 9999,abc", p2t));
        assertEquals(List.of(), SeedLinks.translate(null, p2t));
    }
}
