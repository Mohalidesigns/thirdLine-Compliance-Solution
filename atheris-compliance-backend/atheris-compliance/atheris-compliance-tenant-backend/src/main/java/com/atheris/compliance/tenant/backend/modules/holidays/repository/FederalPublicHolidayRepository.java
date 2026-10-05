package com.atheris.compliance.tenant.backend.modules.holidays.repository;

import com.atheris.compliance.tenant.backend.modules.holidays.entity.FederalPublicHoliday;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FederalPublicHolidayRepository extends JpaRepository<FederalPublicHoliday, Long> {
    List<FederalPublicHoliday> findByTenantIdAndHolidayDateBetweenOrderByHolidayDateAsc(Long tenantId, LocalDate from, LocalDate to);
    List<FederalPublicHoliday> findByTenantIdAndObservedDateBetween(Long tenantId, LocalDate from, LocalDate to);
    List<FederalPublicHoliday> findByTenantIdAndObservedDateBetweenOrderByObservedDateAsc(Long tenantId, LocalDate from, LocalDate to);
    Optional<FederalPublicHoliday> findByHolidayIdAndTenantId(Long holidayId, Long tenantId);
    boolean existsByTenantIdAndHolidayDateAndHolidayIdNot(Long tenantId, LocalDate holidayDate, Long holidayId);
    boolean existsByTenantIdAndHolidayDate(Long tenantId, LocalDate holidayDate);
    boolean existsByTenantIdAndObservedDate(Long tenantId, LocalDate observedDate);
    boolean existsByTenantIdAndObservedDateAndHolidayIdNot(Long tenantId, LocalDate observedDate, Long holidayId);
}
