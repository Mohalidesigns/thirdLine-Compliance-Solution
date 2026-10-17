package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.returns.dto.ReturnStatsDto;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/** Item 4: the Returns card's statuses must be exhaustive so the percentages add up to 100%. */
class ReturnStatusBucketsTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 17);

    private static ReturnFilingInstance i(long returnId, LocalDate due, ReturnFilingStatus st, LocalDate trigger) {
        return ReturnFilingInstance.builder().returnId(returnId).dueDate(due).status(st).triggerDate(trigger).build();
    }

    @Test
    void everyTrackedPeriodLandsInExactlyOneBucket() {
        List<ReturnFilingInstance> rows = List.of(
            i(1, TODAY.minusDays(3), ReturnFilingStatus.NOT_STARTED, null),   // overdue
            i(1, TODAY.minusDays(1), ReturnFilingStatus.IN_PROGRESS, null),   // overdue (in progress but late)
            i(2, TODAY.plusDays(4), ReturnFilingStatus.IN_PROGRESS, null),    // in progress, due soon
            i(2, TODAY.plusDays(10), ReturnFilingStatus.NOT_STARTED, null),   // not yet due, due soon
            i(3, TODAY.plusDays(80), ReturnFilingStatus.NOT_STARTED, null),   // not yet due
            i(3, TODAY.minusDays(40), ReturnFilingStatus.SUBMITTED, null),
            i(4, TODAY.minusDays(70), ReturnFilingStatus.SUBMITTED_LATE, null),
            i(9, TODAY.minusDays(5), ReturnFilingStatus.NOT_STARTED, null),   // event-driven, not triggered: excluded
            i(9, TODAY.minusDays(5), ReturnFilingStatus.NOT_STARTED, TODAY.minusDays(20))); // triggered: overdue

        ReturnStatsDto.StatusBuckets b = ReturnService.statusBuckets(rows, Set.of(9L), TODAY);

        assertEquals(8, b.getTracked());
        assertEquals(3, b.getOverdue());
        assertEquals(1, b.getFiledOnTime());
        assertEquals(1, b.getFiledLate());
        assertEquals(1, b.getInProgressNotDue());
        assertEquals(2, b.getNotYetDue());
        assertEquals(2, b.getDueSoon());
        assertEquals(b.getTracked(),
            b.getOverdue() + b.getFiledOnTime() + b.getFiledLate() + b.getInProgressNotDue() + b.getNotYetDue());
    }

    @Test
    void noPeriodsGivesEmptyBuckets() {
        ReturnStatsDto.StatusBuckets b = ReturnService.statusBuckets(List.of(), Set.of(), TODAY);
        assertEquals(0, b.getTracked());
    }
}
