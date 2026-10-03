package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ToolkitBackfillTest {

    private static ObligationMapping parsed() {
        return ObligationMapping.builder()
            .plainEnglishStatement("The Bank shall report.")
            .title("Reporting")
            .description("(a) report monthly; (b) report annually.")
            .riskDescription("Late reporting")
            .controlOwner("Compliance")
            .build();
    }

    @Test
    void fillsOnlyNullFields() {
        ObligationMapping existing = ObligationMapping.builder()
            .plainEnglishStatement("The Bank shall report.")
            .title("Edited title")
            .controlOwner("Risk")
            .build();

        assertTrue(ToolkitImportService.backfillMissing(existing, parsed()));
        assertEquals("(a) report monthly; (b) report annually.", existing.getDescription());
        assertEquals("Late reporting", existing.getRiskDescription());
        assertEquals("Edited title", existing.getTitle(), "non-null title must not be overwritten");
        assertEquals("Risk", existing.getControlOwner(), "non-null owner must not be overwritten");
    }

    @Test
    void secondRunChangesNothing() {
        ObligationMapping existing = ObligationMapping.builder().plainEnglishStatement("The Bank shall report.").build();
        assertTrue(ToolkitImportService.backfillMissing(existing, parsed()));
        assertFalse(ToolkitImportService.backfillMissing(existing, parsed()), "idempotent: nothing left to fill");
    }

    @Test
    void neverOverwritesExistingDescription() {
        ObligationMapping existing = ObligationMapping.builder()
            .plainEnglishStatement("The Bank shall report.")
            .description("curated text")
            .title("t").riskDescription("r").controlOwner("o")
            .points(List.of(Map.of("marker", "1")))
            .build();
        assertFalse(ToolkitImportService.backfillMissing(existing, parsed()));
        assertEquals("curated text", existing.getDescription());
        assertEquals(1, existing.getPoints().size(), "points kept when the description was already there");
    }

    @Test
    void fillingDescriptionClearsInterpretedOnlyPointsForRegeneration() {
        ObligationMapping existing = ObligationMapping.builder()
            .plainEnglishStatement("The Bank shall report.")
            .points(List.of(Map.of("marker", "1", "pointType", "interpreted")))
            .build();
        assertTrue(ToolkitImportService.backfillMissing(existing, parsed()));
        assertTrue(existing.getPoints().isEmpty(), "points cleared so PointsRetryScheduler regenerates them");
    }

    @Test
    void naturalKeyDistinguishesNullSection() {
        assertNotEquals(ToolkitImportService.obligationKey("s", null), ToolkitImportService.obligationKey("s", ""));
        assertEquals(ToolkitImportService.obligationKey("s", "2.1"), ToolkitImportService.obligationKey("s", "2.1"));
    }
}
