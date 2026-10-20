package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.seed.ToolkitSeedDoc;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** O1 (cross-sheet duplicates) and O2 (row-of-origin control links). */
class ToolkitObligationDedupTest {

    private static ToolkitSeedDoc.ObligationRow row(String source, String section, String title, String verbatim,
                                                    String plain, String primary, String additional) {
        ToolkitSeedDoc.ObligationRow r = new ToolkitSeedDoc.ObligationRow();
        r.setSource(source); r.setSectionRef(section); r.setTitle(title);
        r.setDescription(verbatim); r.setPlain(plain);
        r.setPrimaryControl(primary); r.setAdditionalControl(additional);
        return r;
    }

    private static ObligationMapping obligation(long id, String title, String section, String verbatim, String plain) {
        return ObligationMapping.builder().obligationId(id).regulationId(7L).title(title)
            .specificSectionReference(section).description(verbatim).plainEnglishStatement(plain).build();
    }

    @Test
    void crmpAndTopicalCopiesShareAKeyAndTheTopicalCopyIsKept() {
        ObligationMapping crmp = obligation(323, "Failure to Complete CDD", "24", "A FI shall identify…", "The Bank must:");
        ObligationMapping topical = obligation(361, "Failure to Complete CDD", "Section 24", "A FI shall identify…", "The Bank shall:");
        assertEquals(ToolkitDataRepairService.actKey(7L, crmp), ToolkitDataRepairService.actKey(7L, topical));

        Map<String, List<ToolkitSeedDoc.ObligationRow>> sections = Map.of(
            "crmp", List.of(row("AML Regs", "24", "Failure to Complete CDD", "A FI shall identify…", "The Bank must:", "KYC", null)),
            "amlcft", List.of(row("AML Regs", "Section 24", "Failure to Complete CDD", "A FI shall identify…", "The Bank shall:", "KYC", null)));
        Set<String> topical1 = ToolkitDataRepairService.topicalSignatures(sections);
        assertSame(topical, ToolkitDataRepairService.chooseKeeper(List.of(crmp, topical), topical1));
    }

    @Test
    void controlsLinkOnlyTheObligationOfTheirRow() {
        Map<String, List<ToolkitSeedDoc.ObligationRow>> sections = Map.of("amlcft", List.of(
            row("AML Regs", "1", "Obligation A", "text a", "plain a", "Control X", "Control Y"),
            row("AML Regs", "2", "Obligation B", "text b", "plain b", "Control X", null),
            row("AML Regs", "3", "Obligation C", "text c", "plain c", "Control Z", null)));
        Map<String, Long> actIdByName = Map.of("AML Regs", 7L);
        Map<String, Long> byKey = new HashMap<>();
        byKey.put(ToolkitDataRepairService.actKey(7L, obligation(1, "Obligation A", "1", "text a", "plain a")), 1L);
        byKey.put(ToolkitDataRepairService.actKey(7L, obligation(2, "Obligation B", "2", "text b", "plain b")), 2L);
        byKey.put(ToolkitDataRepairService.actKey(7L, obligation(3, "Obligation C", "3", "text c", "plain c")), 3L);

        Map<String, Set<Long>> links = ToolkitDataRepairService.linksByControlKey(sections, actIdByName, byKey);
        assertEquals(Set.of(1L, 2L), links.get(ToolkitDataRepairService.controlKey("AML Regs", "PRIMARY", "Control X")));
        assertEquals(Set.of(1L), links.get(ToolkitDataRepairService.controlKey("AML Regs", "ADDITIONAL", "Control Y")));
        assertEquals(Set.of(3L), links.get(ToolkitDataRepairService.controlKey("AML Regs", "PRIMARY", "Control Z")));
    }

    @Test
    void crmpSheetIsImportedLast() {
        assertEquals("crmp", ToolkitImportService.OBLIGATION_IMPORT_ORDER.get(ToolkitImportService.OBLIGATION_IMPORT_ORDER.size() - 1));
        assertEquals(ToolkitImportService.CRMP_SECTIONS.size(), ToolkitImportService.OBLIGATION_IMPORT_ORDER.size());
    }
}
