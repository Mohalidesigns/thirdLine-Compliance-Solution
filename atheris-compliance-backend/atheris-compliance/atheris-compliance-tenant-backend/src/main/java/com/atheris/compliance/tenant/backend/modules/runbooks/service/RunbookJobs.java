package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.*;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.time.*;
import java.util.List;
import java.util.Map;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.*;

/**
 * Background work for runbooks. Every job is idempotent and safe on restart: SLA thresholds fire once
 * per execution, a schedule creates at most one execution per due date, a review opens once per date.
 * Each unit of work runs in its own transaction so one bad row never stops the rest.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class RunbookJobs {

    private static final ZoneId LAGOS = ZoneId.of("Africa/Lagos");

    private final RunbookExecutionRepository executions;
    private final RunbookScheduleRepository schedules;
    private final RunbookReviewScheduleRepository reviewSchedules;
    private final RunbookReviewEventRepository reviewEvents;
    private final RunbookRepository runbooks;
    private final RunbookVersionRepository versions;
    private final RunbookExecutionService executionService;
    private final RunbookScheduleService scheduleService;
    private final NotificationService notifications;
    private final UserRepository users;
    private final AuditService audit;
    /** Self proxy so the per-row REQUIRES_NEW transactions apply. */
    @Autowired @Lazy
    private RunbookJobs self;

    @PersistenceContext
    private EntityManager em;

    /** SLA monitor: 50 / 80 / 100 % thresholds (runs every minute). */
    @Scheduled(fixedDelay = 60_000, initialDelay = 45_000)
    public void slaMonitor() {
        List<RunbookExecution> active;
        try {
            active = executions.findByStatusInAndDueAtIsNotNull(ACTIVE_EXECUTION_STATUSES);
        } catch (Throwable e) {
            log.error("Runbook SLA monitor could not load executions: {}", e.getMessage());
            return;
        }
        for (RunbookExecution e : active) {
            try {
                executionService.slaTick(e.getExecutionId());
            } catch (Throwable ex) {
                log.error("SLA check failed for execution {}: {}", e.getExecutionRef(), ex.getMessage());
            }
        }
    }

    /** Creates scheduled executions {@code leadDays} before their due date and opens due reviews (hourly). */
    @Scheduled(cron = "0 7 * * * *")
    public void scheduleRunner() {
        LocalDate today = LocalDate.now(LAGOS);
        try {
            for (RunbookSchedule s : schedules.findByIsActiveTrueAndNextRunAtLessThanEqual(today.plusDays(90))) {
                int lead = s.getLeadDays() != null ? s.getLeadDays() : 5;
                if (s.getNextRunAt() == null || s.getNextRunAt().minusDays(lead).isAfter(today)) continue;
                try {
                    self.runSchedule(s.getScheduleId());
                } catch (Throwable ex) {
                    log.error("Runbook schedule {} failed: {}", s.getScheduleId(), ex.getMessage());
                }
            }
            for (RunbookReviewSchedule r : reviewSchedules.findByNextReviewAtLessThanEqual(today)) {
                try {
                    self.openReview(r.getReviewSchedId());
                } catch (Throwable ex) {
                    log.error("Runbook review {} failed: {}", r.getReviewSchedId(), ex.getMessage());
                }
            }
        } catch (Throwable e) {
            log.error("Runbook schedule runner failed: {}", e.getMessage(), e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void runSchedule(Long scheduleId) {
        try {
            RunbookSchedule s = schedules.findById(scheduleId).orElse(null);
            if (s == null || !Boolean.TRUE.equals(s.getIsActive()) || s.getNextRunAt() == null) return;
            LocalDate due = s.getNextRunAt();
            Runbook rb = runbooks.findById(s.getRunbookId()).orElse(null);
            if (rb != null && RB_PUBLISHED.equals(rb.getStatus()) && rb.getCurrentVersionId() != null
                    && !executions.existsByScheduleIdAndScheduledFor(scheduleId, due)) {
                Integer operatorId = s.getAssigneeUserId() != null ? s.getAssigneeUserId() : rb.getOwnerUserId();
                User operator = operatorId != null ? users.findById(operatorId).orElse(null) : null;
                RunbookVersion v = versions.findById(rb.getCurrentVersionId()).orElse(null);
                if (operator != null && v != null) {
                    Instant dueAt = due.atTime(17, 0).atZone(LAGOS).toInstant();
                    RunbookExecution e = executionService.createExecution(rb, v, "SCHEDULED", scheduleId, operator,
                        null, dueAt, scheduleId, due);
                    notifications.notifyUserEmailed(operator.getUserId(), NOTIFICATION_CATEGORY, NotificationConstants.SEVERITY_MEDIUM,
                        "Scheduled runbook " + rb.getRunbookCode() + " (" + rb.getTitle() + ") is due on " + due + " — " + e.getExecutionRef(),
                        "/runbooks/executions/" + e.getExecutionId(), "Runbook due: " + rb.getRunbookCode());
                    audit.log(null, "execution_scheduled", SUBJECT_EXECUTION, e.getExecutionId(),
                        Map.of("scheduleId", scheduleId, "dueDate", due.toString(), "runbook", rb.getRunbookCode()));
                }
            }
            s.setLastRunAt(due);
            s.setNextRunAt(scheduleService.following(s, due));
            schedules.save(s);
        } catch (Throwable e) {
            try { em.clear(); } catch (Throwable ignored) {}
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
            throw e instanceof RuntimeException re ? re : new RuntimeException(e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void openReview(Long reviewSchedId) {
        try {
            RunbookReviewSchedule r = reviewSchedules.findById(reviewSchedId).orElse(null);
            if (r == null) return;
            Runbook rb = runbooks.findById(r.getRunbookId()).orElse(null);
            if (rb == null || RB_ARCHIVED.equals(rb.getStatus())) return;
            String ref = "scheduled:" + r.getNextReviewAt();
            if (reviewEvents.existsByRunbookIdAndTriggerTypeAndTriggerRef(rb.getRunbookId(), "SCHEDULED", ref)) return;
            reviewEvents.save(RunbookReviewEvent.builder().runbookId(rb.getRunbookId()).triggerType("SCHEDULED")
                .triggerRef(ref).status("OPEN").reviewerUserId(r.getReviewerUserId()).build());
            String msg = "Periodic review due for runbook " + rb.getRunbookCode() + " (" + rb.getTitle() + ")";
            if (r.getReviewerUserId() != null) {
                notifications.notifyUser(r.getReviewerUserId(), NOTIFICATION_CATEGORY, NotificationConstants.SEVERITY_MEDIUM, msg, "/runbooks/" + rb.getRunbookId());
            } else {
                notifications.notifyRole(r.getReviewerRole() != null ? r.getReviewerRole() : "CCO", NOTIFICATION_CATEGORY,
                    NotificationConstants.SEVERITY_MEDIUM, msg, "/runbooks/" + rb.getRunbookId());
            }
            audit.log(null, "runbook_review_due", SUBJECT_RUNBOOK, rb.getRunbookId(), Map.of("dueDate", r.getNextReviewAt().toString()));
        } catch (Throwable e) {
            try { em.clear(); } catch (Throwable ignored) {}
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
            throw e instanceof RuntimeException re ? re : new RuntimeException(e);
        }
    }
}
