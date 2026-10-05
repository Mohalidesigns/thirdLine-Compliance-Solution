package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.holidays.entity.FederalPublicHoliday;
import com.atheris.compliance.tenant.backend.modules.holidays.repository.FederalPublicHolidayRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class WorkingDayServiceTest {
    private final FederalPublicHolidayRepository holidays = mock(FederalPublicHolidayRepository.class);
    private final TenantIdentityService tenantIdentity = mock(TenantIdentityService.class);
    private final WorkingDayService service = new WorkingDayService(holidays, tenantIdentity);

    @Test
    void skipsWeekendsAndOfficialAndObservedHolidaysThenRollsDeadlineForward() {
        when(tenantIdentity.currentTenantId()).thenReturn(42L);
        when(holidays.findByTenantIdAndHolidayDateBetweenOrderByHolidayDateAsc(eq(42L), any(), any()))
            .thenReturn(List.of(FederalPublicHoliday.builder()
                .holidayDate(LocalDate.of(2026, 10, 5))
                .observedDate(LocalDate.of(2026, 10, 6))
                .build()));
        when(holidays.findByTenantIdAndObservedDateBetweenOrderByObservedDateAsc(eq(42L), any(), any()))
            .thenReturn(List.of());

        // Trigger Friday 2 Oct; 1 working day is Monday 5 Oct, a holiday; observed Tuesday 6 Oct;
        // calculated working-day deadline therefore lands Wed 7 Oct.
        assertEquals(LocalDate.of(2026, 10, 7), service.addWorkingDays(LocalDate.of(2026, 10, 2), 1));
        // A manual/base deadline on Sunday 4 Oct rolls to Wednesday after weekend and holiday dates.
        assertEquals(LocalDate.of(2026, 10, 7), service.nextWorkingDay(LocalDate.of(2026, 10, 4)));
    }

    @Test
    void countsCalendarDeadlineDaysThenAdjustsWeekend() {
        when(tenantIdentity.currentTenantId()).thenReturn(null);
        assertEquals(LocalDate.of(2026, 10, 5), service.addWorkingDays(LocalDate.of(2026, 10, 2), 1));
        assertEquals(LocalDate.of(2026, 10, 5), service.nextWorkingDay(LocalDate.of(2026, 10, 4)));
    }
}
