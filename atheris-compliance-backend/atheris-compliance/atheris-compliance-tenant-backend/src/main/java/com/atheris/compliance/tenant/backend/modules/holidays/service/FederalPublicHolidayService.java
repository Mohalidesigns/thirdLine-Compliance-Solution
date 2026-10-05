package com.atheris.compliance.tenant.backend.modules.holidays.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.holidays.dto.FederalPublicHolidayDto;
import com.atheris.compliance.tenant.backend.modules.holidays.dto.FederalPublicHolidayRequest;
import com.atheris.compliance.tenant.backend.modules.holidays.entity.FederalPublicHoliday;
import com.atheris.compliance.tenant.backend.modules.holidays.repository.FederalPublicHolidayRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service @Slf4j @RequiredArgsConstructor
public class FederalPublicHolidayService {
    private final FederalPublicHolidayRepository holidays;
    private final TenantIdentityService tenantIdentity;
    private final AuditService audit;
    @PersistenceContext private EntityManager em;

    @Transactional(readOnly = true)
    public List<FederalPublicHolidayDto> list(Integer year) {
        Long tenantId = requireTenantId();
        int selectedYear = year == null ? LocalDate.now().getYear() : year;
        if (selectedYear < 1900 || selectedYear > 2200) throw ApiException.badRequest("Invalid holiday year");
        LocalDate from = LocalDate.of(selectedYear, 1, 1), to = LocalDate.of(selectedYear, 12, 31);
        Map<Long, FederalPublicHoliday> byId = new java.util.TreeMap<>();
        holidays.findByTenantIdAndHolidayDateBetweenOrderByHolidayDateAsc(tenantId, from, to)
            .forEach(h -> byId.put(h.getHolidayId(), h));
        holidays.findByTenantIdAndObservedDateBetweenOrderByObservedDateAsc(tenantId, from, to)
            .forEach(h -> byId.put(h.getHolidayId(), h));
        return byId.values().stream().sorted(java.util.Comparator.comparing(FederalPublicHoliday::getHolidayDate))
            .map(FederalPublicHolidayDto::from).toList();
    }

    @Transactional
    public FederalPublicHolidayDto create(FederalPublicHolidayRequest req, Integer userId) {
        try {
            Long tenantId = requireTenantId();
            validate(req);
            if (holidays.existsByTenantIdAndHolidayDate(tenantId, req.getHolidayDate()))
                throw ApiException.conflict("duplicate_holiday", "A federal holiday is already recorded for this date.");
            if (holidays.existsByTenantIdAndObservedDate(tenantId, req.getHolidayDate()))
                throw ApiException.conflict("duplicate_holiday", "This date is already recorded as an observed federal holiday.");
            if (holidays.existsByTenantIdAndObservedDate(tenantId, req.getHolidayDate()))
                throw ApiException.conflict("duplicate_holiday", "This date is already recorded as an observed federal holiday.");
            if (req.getObservedDate() != null && holidays.existsByTenantIdAndObservedDate(tenantId, req.getObservedDate()))
                throw ApiException.conflict("duplicate_observed_holiday", "An observed federal holiday is already recorded for this date.");
            if (req.getObservedDate() != null && holidays.existsByTenantIdAndHolidayDate(tenantId, req.getObservedDate()))
                throw ApiException.conflict("duplicate_observed_holiday", "The observed date is already an official federal holiday.");
            if (req.getObservedDate() != null && holidays.existsByTenantIdAndObservedDate(tenantId, req.getHolidayDate()))
                throw ApiException.conflict("holiday_date_in_use", "The official date is already another holiday's observed date.");
            FederalPublicHoliday h = holidays.save(FederalPublicHoliday.builder().tenantId(tenantId)
                .holidayDate(req.getHolidayDate()).observedDate(req.getObservedDate()).name(req.getName().trim()).build());
            audit.log(userId, "federal_public_holiday_created", "federal_public_holiday", h.getHolidayId(), Map.of("date", h.getHolidayDate().toString(), "name", h.getName()));
            return FederalPublicHolidayDto.from(h);
        } catch (Throwable e) { rollback(e); throw rethrow(e); }
    }

    @Transactional
    public FederalPublicHolidayDto update(Long id, FederalPublicHolidayRequest req, Integer userId) {
        try {
            Long tenantId = requireTenantId();
            validate(req);
            FederalPublicHoliday h = holidays.findByHolidayIdAndTenantId(id, tenantId)
                .orElseThrow(() -> ApiException.notFound("Federal holiday not found"));
            if (holidays.existsByTenantIdAndHolidayDateAndHolidayIdNot(tenantId, req.getHolidayDate(), id))
                throw ApiException.conflict("duplicate_holiday", "A federal holiday is already recorded for this date.");
            if (holidays.existsByTenantIdAndObservedDateAndHolidayIdNot(tenantId, req.getHolidayDate(), id))
                throw ApiException.conflict("duplicate_holiday", "This date is already recorded as an observed federal holiday.");
            if (holidays.existsByTenantIdAndObservedDateAndHolidayIdNot(tenantId, req.getHolidayDate(), id))
                throw ApiException.conflict("duplicate_holiday", "This date is already recorded as an observed federal holiday.");
            if (req.getObservedDate() != null && holidays.existsByTenantIdAndObservedDateAndHolidayIdNot(tenantId, req.getObservedDate(), id))
                throw ApiException.conflict("duplicate_observed_holiday", "An observed federal holiday is already recorded for this date.");
            if (req.getObservedDate() != null && holidays.existsByTenantIdAndHolidayDate(tenantId, req.getObservedDate())
                && !req.getObservedDate().equals(h.getHolidayDate()))
                throw ApiException.conflict("duplicate_observed_holiday", "The observed date is already an official federal holiday.");
            if (holidays.existsByTenantIdAndObservedDate(tenantId, req.getHolidayDate())
                && !req.getHolidayDate().equals(h.getObservedDate()))
                throw ApiException.conflict("holiday_date_in_use", "The official date is already another holiday's observed date.");
            Map<String, Object> before = new java.util.LinkedHashMap<>();
            before.put("date", h.getHolidayDate().toString());
            before.put("observedDate", h.getObservedDate() == null ? null : h.getObservedDate().toString());
            before.put("name", h.getName());
            h.setHolidayDate(req.getHolidayDate()); h.setObservedDate(req.getObservedDate()); h.setName(req.getName().trim());
            h = holidays.save(h);
            Map<String, Object> after = new java.util.LinkedHashMap<>();
            after.put("date", h.getHolidayDate().toString());
            after.put("observedDate", h.getObservedDate() == null ? null : h.getObservedDate().toString());
            after.put("name", h.getName());
            audit.log(userId, "federal_public_holiday_updated", "federal_public_holiday", id, before,
                after, null);
            return FederalPublicHolidayDto.from(h);
        } catch (Throwable e) { rollback(e); throw rethrow(e); }
    }

    @Transactional
    public void delete(Long id, Integer userId) {
        try {
            FederalPublicHoliday h = holidays.findByHolidayIdAndTenantId(id, requireTenantId())
                .orElseThrow(() -> ApiException.notFound("Federal holiday not found"));
            Map<String, Object> before = new java.util.LinkedHashMap<>();
            before.put("date", h.getHolidayDate().toString());
            before.put("observedDate", h.getObservedDate() == null ? null : h.getObservedDate().toString());
            before.put("name", h.getName());
            holidays.delete(h);
            audit.log(userId, "federal_public_holiday_deleted", "federal_public_holiday", id,
                before);
        } catch (Throwable e) { rollback(e); throw rethrow(e); }
    }

    private Long requireTenantId() {
        Long id = tenantIdentity.currentTenantId();
        if (id == null) throw ApiException.conflict("tenant_not_provisioned", "Tenant must be provisioned before managing holidays.");
        return id;
    }
    private static void validate(FederalPublicHolidayRequest req) {
        if (req == null) throw ApiException.badRequest("Request body is required.");
        if (req.getHolidayDate() == null) throw ApiException.badRequest("holidayDate is required.");
        if (req.getName() == null || req.getName().isBlank() || req.getName().trim().length() > 200)
            throw ApiException.badRequest("Holiday name is required and cannot exceed 200 characters.");
        if (req.getObservedDate() != null && req.getObservedDate().isBefore(req.getHolidayDate()))
            throw ApiException.badRequest("Observed date must be on or after the official holiday date.");
        if (req.getHolidayDate().equals(req.getObservedDate()))
            throw ApiException.badRequest("Leave observedDate blank when the holiday is observed on its official date.");
    }
    private void rollback(Throwable e) {
        log.error("Federal holiday operation failed: {}", e.getMessage(), e);
        try { em.clear(); } catch (Throwable ignored) {}
        try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
    }
    private static RuntimeException rethrow(Throwable e) { return e instanceof RuntimeException r ? r : new RuntimeException(e); }
}
