package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/** R1 / R3: daily and weekly periods land in their month column; open periods get days late. */
class RenditionGridRulesTest {

    private static ReturnFilingInstance inst(String period, LocalDate due, ReturnFilingStatus status, Integer daysLate) {
        return ReturnFilingInstance.builder().period(period).dueDate(due).status(status).daysLate(daysLate).build();
    }

    @Test
    void dailyAndWeeklyPeriodsBucketIntoTheDueMonth() {
        assertEquals("2026-10", DashboardV2Service.monthKey(inst("2026-10-16", LocalDate.of(2026, 10, 16), ReturnFilingStatus.NOT_STARTED, null)));
        assertEquals("2026-10", DashboardV2Service.monthKey(inst("2026-W42", LocalDate.of(2026, 10, 19), ReturnFilingStatus.NOT_STARTED, null)));
        assertEquals("2026-11", DashboardV2Service.monthKey(inst("2026-11", null, ReturnFilingStatus.NOT_STARTED, null)));
        assertNull(DashboardV2Service.monthKey(inst("2026-W42", null, ReturnFilingStatus.NOT_STARTED, null)));
    }

    @Test
    void openPeriodDaysLateComeFromTheDueDate() {
        LocalDate today = LocalDate.of(2026, 10, 20);
        assertEquals(3, DashboardV2Service.daysLate(inst("2026-10", LocalDate.of(2026, 10, 17), ReturnFilingStatus.IN_PROGRESS, null), today));
        assertEquals(0, DashboardV2Service.daysLate(inst("2026-10", LocalDate.of(2026, 10, 25), ReturnFilingStatus.NOT_STARTED, null), today));
        // a filed period keeps the days late stored at submission
        assertEquals(2, DashboardV2Service.daysLate(inst("2026-10", LocalDate.of(2026, 10, 1), ReturnFilingStatus.SUBMITTED_LATE, 2), today));
    }
}
