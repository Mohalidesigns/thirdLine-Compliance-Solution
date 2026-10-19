package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import com.atheris.compliance.tenant.backend.modules.controls.dto.RecordTestRequest;
import com.atheris.compliance.tenant.backend.modules.controls.entity.*;
import com.atheris.compliance.tenant.backend.modules.controls.repository.*;
import com.atheris.compliance.tenant.backend.modules.findings.service.FindingService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.EscalationNotifier;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ControlTestService {

    private static final long ESCALATE_TO_MANAGER_AFTER_DAYS = 2;
    private static final long ESCALATE_TO_CCO_AFTER_DAYS = 5;

    private final ControlTestResultRepository testRepo;
    private final ControlTaskRepository taskRepo;
    private final ControlRepository controls;
    private final FindingService findingService;
    private final AuditService audit;
    private final NotificationService notifications;
    private final EscalationNotifier escalationNotifier;

    public List<ControlTestResult> getTestHistory(Integer controlId) {
        return testRepo.findByControlIdOrderByTestDateDesc(controlId);
    }

    public List<ControlTestResult> getPendingReview() {
        return testRepo.findByReviewStatus(WorkflowStatus.REVIEW_PENDING);
    }

    public List<ControlTask> getTasksForUser(Integer userId) {
        return taskRepo.findByAssignedToUserIdAndStatusIn(userId,
            List.of(WorkflowStatus.TASK_PENDING, WorkflowStatus.TASK_IN_PROGRESS, WorkflowStatus.TASK_OVERDUE));
    }

    public List<ControlTask> getAllOverdue() {
        return taskRepo.findByStatusAndDueDateBefore(WorkflowStatus.TASK_PENDING, LocalDate.now());
    }

    public List<ControlTask> getTasksForControl(Integer controlId) {
        return taskRepo.findByControlId(controlId).stream()
            .filter(t -> !WorkflowStatus.TASK_COMPLETED.equals(t.getStatus()))
            .toList();
    }

    @Transactional
    public ControlTestResult recordTest(Integer controlId, RecordTestRequest req, User tester) {
        Control control = controls.findById(controlId)
            .orElseThrow(() -> ApiException.notFound("Control not found: " + controlId));
        ControlTestResult result = ControlTestResult.builder()
            .controlId(controlId)
            .testDate(req.getTestDate())
            .testedByUserId(tester.getUserId())
            .testedByName(tester.getFullName())
            .result(req.getResult())
            .resultDescription(req.getResultDescription())
            .failureDetails(req.getFailureDetails())
            .failureSeverity(req.getFailureSeverity())
            .evidenceUrl(req.getEvidenceUrl())
            .remediationRequired(req.getRemediationRequired())
            .remediationOwnerUserId(req.getRemediationOwnerUserId())
            .remediationOwnerId(req.getRemediationOwnerId())
            .remediationDeadline(req.getRemediationDeadline())
            .reviewStatus(WorkflowStatus.REVIEW_PENDING)
            .build();
        testRepo.save(result);
        updateResidualRisk(control, req.getResult());

        boolean failed = WorkflowStatus.TEST_FAILED.equals(req.getResult())
                      || WorkflowStatus.TEST_PARTIAL.equals(req.getResult());
        if (failed) {
            findingService.autoRaiseFromTest(result, control);
        }

        taskRepo.findByControlId(controlId).stream()
            .filter(t -> WorkflowStatus.TASK_PENDING.equals(t.getStatus())
                      || WorkflowStatus.TASK_IN_PROGRESS.equals(t.getStatus())
                      || WorkflowStatus.TASK_OVERDUE.equals(t.getStatus()))
            .forEach(t -> {
                t.setStatus(WorkflowStatus.TASK_COMPLETED);
                t.setCompletedByTestId(result.getTestId());
                taskRepo.save(t);
            });
        scheduleNextTest(control);

        if (failed) {
            Integer notifyUser = control.getControlOwnerUserId() != null
                ? control.getControlOwnerUserId() : tester.getUserId();
            notifications.notifyUserEmailed(notifyUser, NotificationConstants.CATEGORY_CONTROLS, NotificationConstants.SEVERITY_HIGH,
                "Control test " + req.getResult().toLowerCase() + ": "
                    + safeName(control) + " — a finding has been raised",
                "/controls", "Control test failed — action required");
        }

        audit.log(tester.getUserId(), "control_test_recorded", "control", controlId.longValue(),
            Map.of("result", req.getResult()));
        return result;
    }

    @Transactional
    public ControlTestResult reviewTest(Long testId, String decision, String notes, User reviewer) {
        ControlTestResult t = testRepo.findById(testId)
            .orElseThrow(() -> ApiException.notFound("Control test not found: " + testId));
        if (!WorkflowStatus.REVIEW_ACCEPTED.equals(decision) && !WorkflowStatus.REVIEW_REJECTED.equals(decision)) {
            throw ApiException.badRequest("Decision must be " + WorkflowStatus.REVIEW_ACCEPTED
                + " or " + WorkflowStatus.REVIEW_REJECTED);
        }
        if (t.getTestedByUserId() != null && t.getTestedByUserId().equals(reviewer.getUserId())) {
            throw ApiException.conflict("self_review",
                "You cannot review a control test you recorded yourself");
        }
        t.setReviewedByUserId(reviewer.getUserId());
        t.setReviewedByName(reviewer.getFullName());
        t.setReviewStatus(decision);
        t.setReviewNotes(notes);
        t.setReviewedAt(Instant.now());
        if (WorkflowStatus.REVIEW_REJECTED.equals(decision)) {
            boolean openTaskExists = taskRepo.findByControlId(t.getControlId()).stream()
                .anyMatch(task -> !WorkflowStatus.TASK_COMPLETED.equals(task.getStatus()));
            if (!openTaskExists) {
                controls.findById(t.getControlId()).ifPresent(c -> {
                    taskRepo.save(ControlTask.builder()
                        .controlId(c.getControlId())
                        .controlNumber(c.getControlNumber())
                        .controlName(c.getName())
                        .taskType(WorkflowStatus.TASK_TYPE_SCHEDULED_TEST)
                        .assignedToUserId(c.getControlOwnerUserId())
                        .assignedToName(c.getControlOwnerName())
                        .dueDate(LocalDate.now().plusDays(3))
                        .status(WorkflowStatus.TASK_PENDING)
                        .escalationLevel(0)
                        .build());
                });
            }
        }
        audit.log(reviewer.getUserId(), "test_reviewed", "control_test", testId, Map.of("decision", decision));
        return testRepo.save(t);
    }

    @Transactional
    public void scheduleNextTest(Control control) {
        if (control.getTestFrequencyDays() == null) {
            return;
        }
        LocalDate nextDue = LocalDate.now().plus(control.getTestFrequencyDays(), ChronoUnit.DAYS);
        taskRepo.save(ControlTask.builder()
            .controlId(control.getControlId())
            .controlNumber(control.getControlNumber())
            .controlName(control.getName())
            .taskType(WorkflowStatus.TASK_TYPE_SCHEDULED_TEST)
            .assignedToUserId(control.getControlOwnerUserId())
            .assignedToName(control.getControlOwnerName())
            .dueDate(nextDue)
            .status(WorkflowStatus.TASK_PENDING)
            .escalationLevel(0)
            .build());
    }

    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void processOverdueTasks() {
        LocalDate today = LocalDate.now();
        List<ControlTask> due = taskRepo.findByStatusAndDueDateBefore(WorkflowStatus.TASK_PENDING, today);
        for (ControlTask t : due) {
            t.setStatus(WorkflowStatus.TASK_OVERDUE);
            taskRepo.save(t);
        }
        log.info("Marked {} control tasks as overdue", due.size());

        for (ControlTask t : taskRepo.findByStatusAndDueDateBefore(WorkflowStatus.TASK_OVERDUE, today.plusDays(1))) {
            long daysOverdue = ChronoUnit.DAYS.between(t.getDueDate(), today);
            int implied = daysOverdue > ESCALATE_TO_CCO_AFTER_DAYS ? 3
                        : daysOverdue > ESCALATE_TO_MANAGER_AFTER_DAYS ? 2
                        : 1;
            int current = t.getEscalationLevel() != null ? t.getEscalationLevel() : 0;
            if (implied <= current) {
                continue;
            }
            t.setEscalationLevel(implied);
            t.setEscalatedAt(Instant.now());
            taskRepo.save(t);
            try {
                escalationNotifier.escalate(implied, t.getAssignedToUserId(), NotificationConstants.CATEGORY_CONTROLS,
                    "Control test overdue",
                    "Control test \"" + safeName(t) + "\" is " + daysOverdue + " day(s) overdue (L" + implied + ")",
                    "/controls");
            } catch (Exception e) {
                log.warn("Control-task escalation notify failed for task {}: {}", t.getTaskId(), e.getMessage());
            }
            log.info("Control task {} escalated to level {}", t.getTaskId(), implied);
        }
    }

    private void updateResidualRisk(Control c, String result) {
        String risk = ResidualRisk.fromTestResult(result, c.getInherentRisk());
        if (risk != null) {
            c.setResidualRisk(risk);
            controls.save(c);
        }
    }

    private static String safeName(Control c) {
        return c.getName() != null && !c.getName().isBlank() ? c.getName() : "Control " + c.getControlId();
    }

    private static String safeName(ControlTask t) {
        return t.getControlName() != null && !t.getControlName().isBlank()
            ? t.getControlName() : "Control " + t.getControlId();
    }
}