package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/** R2 (filing regulator = regulator, not the unit) and N1 (preparer ≠ reviewer). */
class ReturnRegulatorRepairServiceTest {

    private static final TenantRegulator CBN = TenantRegulator.builder().id(1L).name("Central Bank of Nigeria").abbreviation("CBN").build();

    private static RegulatoryReturn ret(String filingRegulator, String unit) {
        return RegulatoryReturn.builder().tenantRegulatorId(1L).filingRegulator(filingRegulator).responsibleUnit(unit).build();
    }

    @Test
    void unitCopiedIntoRegulatorIsReplaced() {
        RegulatoryReturn r = ret("Trade & Exchange / Financial Markets Department", "Trade & Exchange / Financial Markets Department");
        assertTrue(ReturnRegulatorRepairService.apply(r, CBN));
        assertEquals("CBN", r.getFilingRegulator());
        assertFalse(ReturnRegulatorRepairService.apply(r, CBN), "idempotent");
    }

    @Test
    void blankRegulatorIsFilled() {
        RegulatoryReturn r = ret(null, "Banking Supervision");
        assertTrue(ReturnRegulatorRepairService.apply(r, CBN));
        assertEquals("CBN", r.getFilingRegulator());
    }

    @Test
    void aRealRegulatorNameIsKept() {
        RegulatoryReturn r = ret("Central Bank of Nigeria", "Central Bank of Nigeria");
        assertFalse(ReturnRegulatorRepairService.apply(r, CBN));
        RegulatoryReturn user = ret("NFIU", "Compliance");
        assertFalse(ReturnRegulatorRepairService.apply(user, CBN), "user-entered regulator differs from the unit");
        assertEquals("NFIU", user.getFilingRegulator());
    }

    @Test
    void preparersAreTheDataGatheringAndDraftUsers() {
        Map<String, Map<String, String>> stageData = Map.of(
            "Not Started", Map.of("completedByUserId", "9"),
            "Data Gathering", Map.of("completedByUserId", "4"),
            "Draft", Map.of("completedByUserId", "5"));
        assertEquals(Set.of("4", "5"), ReturnService.preparers(stageData));
    }
}
