package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.holidays.entity.FederalPublicHoliday;
import com.atheris.compliance.tenant.backend.modules.holidays.repository.FederalPublicHolidayRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;

@Service @RequiredArgsConstructor
public class WorkingDayService {
    private final FederalPublicHolidayRepository holidays;
    private final TenantIdentityService tenantIdentity;

    public LocalDate addWorkingDays(LocalDate start, int days) {
        return addWorkingDays(start, days, true);
    }

    public LocalDate addCalendarDays(LocalDate start, int days) {
        return addWorkingDays(start, days, false);
    }

    private LocalDate addWorkingDays(LocalDate start, int days, boolean workingDayCount) {
        Set<LocalDate> nonWorkingDates = holidaysBetween(start, start.plusDays(days * 3L + 20));
        LocalDate date = start;
        int added = 0;
        while (added < days) {
            date = date.plusDays(1);
            if (!workingDayCount || isWorkingDay(date, nonWorkingDates)) added++;
        }
        return adjust(date, nonWorkingDates);
    }

    public LocalDate nextWorkingDay(LocalDate date) {
        return adjust(date, holidaysBetween(date, date.plusDays(20)));
    }

    private LocalDate adjust(LocalDate date, Set<LocalDate> holidays) {
        LocalDate result = date;
        int maxShiftDays = 370;
        while (!isWorkingDay(result, holidays) && maxShiftDays-- > 0) result = result.plusDays(1);
        if (!isWorkingDay(result, holidays)) throw ApiException.conflict("holiday_calendar_incomplete",
            "No working day could be found within 370 days; check the configured federal holiday calendar.");
        return result;
    }

    private Set<LocalDate> holidaysBetween(LocalDate from, LocalDate to) {
        Long tenantId = tenantIdentity.currentTenantId();
        Set<LocalDate> dates = new HashSet<>();
        if (tenantId == null) return dates;
        List<FederalPublicHoliday> records = new ArrayList<>();
        records.addAll(holidays.findByTenantIdAndHolidayDateBetweenOrderByHolidayDateAsc(tenantId, from, to));
        records.addAll(holidays.findByTenantIdAndObservedDateBetweenOrderByObservedDateAsc(tenantId, from, to));
        for (FederalPublicHoliday holiday : records) {
            if (holiday.getHolidayDate() != null) dates.add(holiday.getHolidayDate());
            if (holiday.getObservedDate() != null) dates.add(holiday.getObservedDate());
        }
        return dates;
    }

    private static boolean isWorkingDay(LocalDate date, Set<LocalDate> holidays) {
        DayOfWeek day = date.getDayOfWeek();
        return day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY && !holidays.contains(date);
    }

}
