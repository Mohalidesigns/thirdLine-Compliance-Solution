package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.returns.dto.ReturnRegisterItem;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The register is assembled from several queries and sorted in memory. Only whitelisted fields are
 * honoured; anything else (including service-resolved fields like actName) must fall back to the
 * default due-date sort instead of throwing PropertyReferenceException.
 */
class ReturnRegisterSortTest {

    private static ReturnRegisterItem item(String name, String regulator, LocalDate due, String status) {
        return ReturnRegisterItem.builder()
            .returnId((long) name.hashCode())
            .returnName(name)
            .filingRegulator(regulator)
            .currentDueDate(due)
            .currentStatus(status)
            .build();
    }

    private static List<String> names(List<ReturnRegisterItem> rows) {
        return rows.stream().map(ReturnRegisterItem::getReturnName).toList();
    }

    @Test
    void sortsByWhitelistedReturnNameCaseInsensitively() {
        List<ReturnRegisterItem> rows = new ArrayList<>(List.of(
            item("Charlie", "CBN", LocalDate.of(2026, 1, 1), "Not Started"),
            item("alpha", "NDIC", LocalDate.of(2026, 3, 1), "Not Started"),
            item("Bravo", "SEC", LocalDate.of(2026, 2, 1), "Not Started")));

        rows.sort(ReturnService.registerComparator(Sort.by("returnName")));

        assertEquals(List.of("alpha", "Bravo", "Charlie"), names(rows));
    }

    @Test
    void sortsByCurrentDueDateDescending() {
        List<ReturnRegisterItem> rows = new ArrayList<>(List.of(
            item("A", "CBN", LocalDate.of(2026, 1, 1), "Not Started"),
            item("B", "CBN", LocalDate.of(2026, 3, 1), "Not Started"),
            item("C", "CBN", LocalDate.of(2026, 2, 1), "Not Started")));

        rows.sort(ReturnService.registerComparator(Sort.by(Sort.Direction.DESC, "currentDueDate")));

        assertEquals(List.of("B", "C", "A"), names(rows));
    }

    @Test
    void defaultSortIsDueDateAscending() {
        List<ReturnRegisterItem> rows = new ArrayList<>(List.of(
            item("A", "CBN", LocalDate.of(2026, 1, 1), "Not Started"),
            item("B", "CBN", LocalDate.of(2026, 3, 1), "Not Started"),
            item("C", "CBN", LocalDate.of(2026, 2, 1), "Not Started")));

        rows.sort(ReturnService.registerComparator(Sort.unsorted()));

        assertEquals(List.of("A", "C", "B"), names(rows));
    }

    @Test
    void unknownFieldNeverThrowsAndFallsBackToDueDate() {
        List<ReturnRegisterItem> rows = new ArrayList<>(List.of(
            item("A", "CBN", LocalDate.of(2026, 2, 1), "Not Started"),
            item("B", "CBN", LocalDate.of(2026, 1, 1), "Not Started")));

        assertDoesNotThrow(() -> rows.sort(ReturnService.registerComparator(Sort.by("actName"))));
        assertEquals(List.of("B", "A"), names(rows));
    }
}
