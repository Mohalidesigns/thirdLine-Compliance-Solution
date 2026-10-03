package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ToolkitControlDedupTest {

    private static final Instant OLD = Instant.parse("2026-09-10T00:00:00Z");
    private static final Instant NEW = Instant.parse("2026-10-04T00:00:00Z");

    private static ComplianceControl control(long id, Instant created, Long actId, String text,
                                             String type, String number, String links) {
        return ComplianceControl.builder()
            .complianceControlId(id).createdAt(created).actId(actId)
            .complianceControl(text).controlType(type).controlNumber(number)
            .linkedObligationIds(links).build();
    }

    // ── natural key ──

    @Test
    void keyIgnoresCaseAndWhitespace() {
        assertEquals(
            ToolkitControlDedup.naturalKey(7L, "  Board  approves\n the AML policy ", "PRIMARY"),
            ToolkitControlDedup.naturalKey(7L, "board approves the aml POLICY", "primary"));
    }

    @Test
    void keySeparatesActAndType() {
        String k = ToolkitControlDedup.naturalKey(7L, "Text", "PRIMARY");
        assertNotEquals(k, ToolkitControlDedup.naturalKey(8L, "Text", "PRIMARY"));
        assertNotEquals(k, ToolkitControlDedup.naturalKey(7L, "Text", "ADDITIONAL"));
        assertNotEquals(k, ToolkitControlDedup.naturalKey(null, "Text", "PRIMARY"));
    }

    @Test
    void blankTypeDefaultsToPrimary() {
        assertEquals(ToolkitControlDedup.naturalKey(1L, "x", "PRIMARY"),
            ToolkitControlDedup.naturalKey(1L, "x", null));
    }

    // ── linked id merge ──

    @Test
    void mergeLinkedIdsUnionsInOrder() {
        assertEquals("1,2,3,4", ToolkitControlDedup.mergeLinkedIds("1, 2,3", "3,4,1"));
        assertEquals("5", ToolkitControlDedup.mergeLinkedIds(null, "5"));
        assertEquals("5", ToolkitControlDedup.mergeLinkedIds("5", null));
        assertNull(ToolkitControlDedup.mergeLinkedIds(null, " , "));
    }

    // ── duplicate detection ──

    private static final ZoneId ZONE = ZoneOffset.UTC;

    @Test
    void laterDayReinsertsAreDuplicatesButSameDayRepeatsAreKept() {
        ComplianceControl keep = control(10, OLD, 1L, "Do X", "PRIMARY", "CONDC001", "1");
        ComplianceControl sameDayRepeat = control(11, OLD.plusSeconds(3600), 1L, "Do X", "PRIMARY", "CONDC003", "4");
        ComplianceControl reinsert = control(900, NEW, 1L, "do  x", "PRIMARY", "CONDC002", "2");
        ComplianceControl otherType = control(12, NEW, 1L, "Do X", "ADDITIONAL", "CONDA001", null);

        List<ToolkitControlDedup.DuplicateGroup> groups = ToolkitControlDedup.findDuplicates(
            List.of(reinsert, otherType, sameDayRepeat, keep), c -> true, ZONE);

        assertEquals(1, groups.size());
        assertSame(keep, groups.get(0).keep());
        assertEquals(List.of(reinsert), groups.get(0).duplicates());
    }

    @Test
    void groupOfOnlySameDayRepeatsIsUntouched() {
        assertTrue(ToolkitControlDedup.findDuplicates(List.of(
            control(1, OLD, 1L, "Do X", "PRIMARY", "A001", "1"),
            control(2, OLD.plusSeconds(5), 1L, "Do X", "PRIMARY", "A002", "2")), c -> true, ZONE).isEmpty());
    }

    @Test
    void referencedRowIsNeverDeleted() {
        ComplianceControl keep = control(1, OLD, 1L, "Do X", "PRIMARY", "A001", null);
        ComplianceControl referenced = control(2, NEW, 1L, "Do X", "PRIMARY", "A002", null);
        referenced.setObligationId(99L);

        assertTrue(ToolkitControlDedup.findDuplicates(
            List.of(keep, referenced), c -> c.getObligationId() == null, ZONE).isEmpty());
    }

    @Test
    void noGroupsWhenAllUnique() {
        assertTrue(ToolkitControlDedup.findDuplicates(List.of(
            control(1, OLD, 1L, "A", "PRIMARY", "N1", null),
            control(2, NEW, 1L, "B", "PRIMARY", "N2", null)), c -> true, ZONE).isEmpty());
    }

    // ── merge into kept row ──

    @Test
    void mergeIntoUnionsLinksOnlyAndLeavesOtherFields() {
        ComplianceControl keep = control(1, OLD, 1L, "Do X", "PRIMARY", "A001", "1,2");
        keep.setOwnerName("CCO");
        ComplianceControl dup = control(2, NEW, 1L, "Do X", "PRIMARY", "A002", "2,3");
        dup.setOwnerName("Head of Ops");
        dup.setResidualRiskRating("High");

        assertTrue(ToolkitControlDedup.mergeInto(keep, dup));
        assertEquals("1,2,3", keep.getLinkedObligationIds());
        assertEquals("CCO", keep.getOwnerName());
        assertNull(keep.getResidualRiskRating());   // seed row not otherwise altered
        assertEquals("A001", keep.getControlNumber());
    }

    @Test
    void mergeIntoReportsNoChangeForIdenticalDuplicate() {
        ComplianceControl keep = control(1, OLD, 1L, "Do X", "PRIMARY", "A001", "1,2");
        ComplianceControl dup = control(2, NEW, 1L, "Do X", "PRIMARY", "A002", "2,1");
        assertFalse(ToolkitControlDedup.mergeInto(keep, dup));
    }

    // ── index ──

    @Test
    void indexPrefersOldest() {
        ComplianceControl oldRow = control(5, OLD, 1L, "Do X", "PRIMARY", "A001", null);
        ComplianceControl newRow = control(6, NEW, 1L, "DO X", "PRIMARY", "A002", null);
        Map<String, ComplianceControl> idx = ToolkitControlDedup.indexByKey(List.of(newRow, oldRow));
        assertSame(oldRow, idx.get(ToolkitControlDedup.naturalKey(1L, "do x", "PRIMARY")));
    }

    // ── number allocation ──

    @Test
    void allocatorContinuesFromHighestAndNeverReuses() {
        ToolkitControlDedup.NumberAllocator a = new ToolkitControlDedup.NumberAllocator(
            List.of("CONDC001", "CONDC205", "CONDA017", "CONDCX9", "CRMPC1680"));
        assertEquals("CONDC206", a.next("CONDC"));
        assertEquals("CONDC207", a.next("CONDC"));
        assertEquals("CONDA018", a.next("CONDA"));
        assertEquals("CRMPC1681", a.next("CRMPC"));
        assertEquals("ESGC001", a.next("ESGC"));
    }

    @Test
    void allocatorSkipsTakenNumbersOfOtherShapes() {
        // "CAPIC" prefix must not be confused by "CAP001" (CMP numbers), and a reserved
        // number is skipped.
        ToolkitControlDedup.NumberAllocator a = new ToolkitControlDedup.NumberAllocator(
            List.of("CAP001", "CAP025"));
        a.reserve("CAPIC001");
        assertEquals("CAPIC002", a.next("CAPIC"));
        assertTrue(a.isTaken("CAPIC002"));
    }
}
