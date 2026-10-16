package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.holidays.repository.FederalPublicHolidayRepository;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.ScheduleDto;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.ScheduleRequest;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.Runbook;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookReviewSchedule;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookSchedule;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.RunbookRepository;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.RunbookReviewScheduleRepository;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.RunbookScheduleRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.*;

/**
 * Execution schedules and periodic review dates. Run dates follow the frequency from an anchor
 * date (no drift: the k-th run is anchor + k periods) and, when {@code skipHolidays}, move to the
 * previous business day if they fall on a weekend or a Nigerian public holiday (holidays module).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RunbookScheduleService {

    private static final Set<String> SCHEDULABLE = Set.of("DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL");

    private final RunbookScheduleRepository schedules;
    private final RunbookReviewScheduleRepository reviewSchedules;
    private final RunbookRepository runbooks;
    private final FederalPublicHolidayRepository holidays;
    private final TenantIdentityService tenantIdentity;
    private final RunbookTreeService tree;
    private final RunbookViews views;
    private final AuditService audit;

    public List<ScheduleDto> list(Long runbookId) {
        List<RunbookSchedule> rows = schedules.findByRunbookIdOrderByScheduleIdAsc(runbookId);
        Map<Integer, String> names = tree.userNames(rows.stream().map(RunbookSchedule::getAssigneeUserId).toList());
        return rows.stream().map(s -> views.schedule(s, names)).toList();
    }

    @Transactional
    public ScheduleDto create(Long runbookId, ScheduleRequest req, Integer userId) {
        Runbook rb = runbooks.findById(runbookId).orElseThrow(() -> ApiException.notFound("Runbook not found: " + runbookId));
        if (RB_ARCHIVED.equals(rb.getStatus()) || RB_DEPRECATED.equals(rb.getStatus())) {
            throw ApiException.conflict("Deprecated or archived runbooks cannot be scheduled");
        }
        RunbookSchedule s = RunbookSchedule.builder().runbookId(runbookId).build();
        apply(s, req);
        s = schedules.save(s);
        audit.log(userId, "runbook_schedule_created", SUBJECT_RUNBOOK, runbookId,
            Map.of("scheduleId", s.getScheduleId(), "frequency", s.getFrequency(), "nextRunAt", String.valueOf(s.getNextRunAt())));
        return views.schedule(s, tree.userNames(Collections.singleton(s.getAssigneeUserId())));
    }

    @Transactional
    public ScheduleDto update(Long runbookId, Long scheduleId, ScheduleRequest req, Integer userId) {
        RunbookSchedule s = find(runbookId, scheduleId);
        apply(s, req);
        s = schedules.save(s);
        audit.log(userId, "runbook_schedule_updated", SUBJECT_RUNBOOK, runbookId,
            Map.of("scheduleId", scheduleId, "frequency", s.getFrequency(), "nextRunAt", String.valueOf(s.getNextRunAt())));
        return views.schedule(s, tree.userNames(Collections.singleton(s.getAssigneeUserId())));
    }

    @Transactional
    public void delete(Long runbookId, Long scheduleId, Integer userId) {
        RunbookSchedule s = find(runbookId, scheduleId);
        schedules.delete(s);
        audit.log(userId, "runbook_schedule_deleted", SUBJECT_RUNBOOK, runbookId, Map.of("scheduleId", scheduleId));
    }

    private RunbookSchedule find(Long runbookId, Long scheduleId) {
        RunbookSchedule s = schedules.findById(scheduleId).orElseThrow(() -> ApiException.notFound("Schedule not found: " + scheduleId));
        if (!s.getRunbookId().equals(runbookId)) throw ApiException.notFound("Schedule not found: " + scheduleId);
        return s;
    }

    private void apply(RunbookSchedule s, ScheduleRequest req) {
        if (req.getFrequency() == null || !SCHEDULABLE.contains(req.getFrequency())) {
            throw ApiException.badRequest("Frequency must be one of " + SCHEDULABLE);
        }
        if (req.getFirstRunDate() == null) throw ApiException.badRequest("First run date is required");
        int lead = req.getLeadDays() != null ? req.getLeadDays() : 5;
        if (lead < 0 || lead > 90) throw ApiException.badRequest("Lead days must be between 0 and 90");
        s.setFrequency(req.getFrequency());
        s.setAnchorDate(req.getFirstRunDate());
        s.setLeadDays(lead);
        s.setAssigneeUserId(req.getAssigneeUserId());
        s.setAssigneeRole(req.getAssigneeRole());
        s.setSkipHolidays(!Boolean.FALSE.equals(req.getSkipHolidays()));
        s.setIsActive(!Boolean.FALSE.equals(req.getActive()));
        s.setNextRunAt(nextOccurrence(s, LocalDate.now()));
    }

    /** First run date on or after {@code from}, holiday-adjusted when the schedule asks for it. */
    public LocalDate nextOccurrence(RunbookSchedule s, LocalDate from) {
        LocalDate anchor = s.getAnchorDate() != null ? s.getAnchorDate() : from;
        for (int k = 0; k < 5000; k++) {
            LocalDate raw = plus(anchor, s.getFrequency(), k);
            LocalDate d = Boolean.TRUE.equals(s.getSkipHolidays()) ? previousBusinessDay(raw) : raw;
            if (!d.isBefore(from)) return d;
        }
        return null;
    }

    /** The run after the current one (advances past {@code current}). */
    public LocalDate following(RunbookSchedule s, LocalDate current) {
        return nextOccurrence(s, current.plusDays(1));
    }

    static LocalDate plus(LocalDate anchor, String frequency, int k) {
        return switch (frequency) {
            case "DAILY" -> anchor.plusDays(k);
            case "WEEKLY" -> anchor.plusWeeks(k);
            case "MONTHLY" -> anchor.plusMonths(k);
            case "QUARTERLY" -> anchor.plusMonths(3L * k);
            case "SEMI_ANNUAL" -> anchor.plusMonths(6L * k);
            case "ANNUAL" -> anchor.plusYears(k);
            default -> anchor;
        };
    }

    /** Moves a weekend or public holiday back to the previous business day (spec §11). */
    public LocalDate previousBusinessDay(LocalDate d) {
        Long tenantId = safeTenantId();
        LocalDate x = d;
        for (int i = 0; i < 14; i++) {
            boolean weekend = x.getDayOfWeek() == DayOfWeek.SATURDAY || x.getDayOfWeek() == DayOfWeek.SUNDAY;
            boolean holiday = tenantId != null && (holidays.existsByTenantIdAndHolidayDate(tenantId, x)
                || holidays.existsByTenantIdAndObservedDate(tenantId, x));
            if (!weekend && !holiday) return x;
            x = x.minusDays(1);
        }
        return d;
    }

    private Long safeTenantId() {
        try {
            return tenantIdentity.currentTenantId();
        } catch (Throwable e) {
            return null;
        }
    }

    // ── review cadence ─────────────────────────────────────────────────────

    /** Sets (or moves) the next periodic review after a publish or a cadence change. */
    @Transactional
    public void scheduleReview(Runbook rb, LocalDate from) {
        String cadence = rb.getReviewCadence() != null && REVIEW_CADENCES.contains(rb.getReviewCadence()) ? rb.getReviewCadence() : "ANNUAL";
        LocalDate next = switch (cadence) {
            case "QUARTERLY" -> from.plusMonths(3);
            case "SEMI_ANNUAL" -> from.plusMonths(6);
            default -> from.plusYears(1);
        };
        RunbookReviewSchedule r = reviewSchedules.findByRunbookId(rb.getRunbookId())
            .orElseGet(() -> RunbookReviewSchedule.builder().runbookId(rb.getRunbookId()).nextReviewAt(next).build());
        r.setCadence(cadence);
        r.setNextReviewAt(next);
        r.setReviewerUserId(rb.getOwnerUserId());
        reviewSchedules.save(r);
    }
}
