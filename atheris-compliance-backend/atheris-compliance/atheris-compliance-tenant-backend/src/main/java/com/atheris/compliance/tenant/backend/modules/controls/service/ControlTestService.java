package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import com.atheris.compliance.tenant.backend.modules.controls.dto.RecordTestRequest;
import com.atheris.compliance.tenant.backend.modules.controls.entity.*;
import com.atheris.compliance.tenant.backend.modules.controls.repository.*;
import com.atheris.compliance.tenant.backend.modules.findings.service.FindingService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationTemplateService;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
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

    private final ControlTestResultRepository testRepo;
    private final ControlTaskRepository taskRepo;
    private final ControlRepository controls;
    private final FindingService findingService;
    private final AuditService audit;
    private final NotificationService notifications;
    private final NotificationTemplateService templates;
    private final ControlTestDetails details;
    private final OwnerRepository ownerRepo;

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
        return record(controlId, req, tester.getUserId(), tester.getFullName());
    }

    @Transactional
    public ControlTestResult recordTestFromLink(Integer controlId, RecordTestRequest req, String testerName) {
        return record(controlId, req, null, testerName);
    }

    private ControlTestResult record(Integer controlId, RecordTestRequest req, Integer testerUserId, String testerName) {
        Control control = controls.findById(controlId)
            .orElseThrow(() -> ApiException.notFound("Control not found: " + controlId));
        ControlTestResult result = ControlTestResult.builder()
            .controlId(controlId)
            .testDate(req.getTestDate())
            .testedByUserId(testerUserId)
            .testedByName(testerName)
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

        ControlTask openTask = taskRepo.findByControlId(controlId).stream()
            .filter(t -> WorkflowStatus.TASK_PENDING.equals(t.getStatus())
                      || WorkflowStatus.TASK_IN_PROGRESS.equals(t.getStatus())
                      || WorkflowStatus.TASK_OVERDUE.equals(t.getStatus()))
            .findFirst().orElse(null);
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
            Integer notifyUser = control.getTesterUserId() != null
                ? control.getTesterUserId() : testerUserId;
            notifications.notifyUserEmailed(notifyUser, NotificationConstants.CATEGORY_CONTROLS, NotificationConstants.SEVERITY_HIGH,
                "Control test " + req.getResult().toLowerCase() + ": "
                    + safeName(control) + " — a finding has been raised",
                "/controls", "Control test failed — action required");
        }

        // Maker/checker: the test needs a review by someone other than the tester.
        String reviewSummary = "Control test (" + req.getResult().toLowerCase() + ") on " + safeName(control)
            + " by " + (testerName == null ? "the responsible person" : testerName) + " is waiting for your review";
        Map<String, String> reviewVars = details.messageVars(control, openTask, testerName);
        details.putResult(reviewVars, req.getResult(), null);
        NotificationTemplateService.RenderedEmail review = templates.render(
            EscalationConstants.KEY_CONTROL_DATA_REVIEW, reviewVars);
        String reviewSubject = review.subject() != null ? review.subject()
            : "Review needed: control test on " + safeName(control);
        String reviewBody = review.body() != null ? review.body() : reviewSummary;
        List<String> reviewCc = ownerCc(control);
        for (String role : List.of(AppRole.ANALYST, AppRole.CCO)) {
            notifications.notifyRoleEmailed(role, NotificationConstants.CATEGORY_CONTROLS, NotificationConstants.SEVERITY_MEDIUM,
                reviewSummary, "/controls", reviewSubject, reviewBody, reviewCc, testerUserId);
        }

        audit.log(testerUserId, "control_test_recorded", "control", controlId.longValue(),
            Map.of("result", req.getResult()));
        return result;
    }

    private List<String> ownerCc(Control control) {
        if (control.getControlOwnerId() == null) return List.of();
        String ownerEmail = ownerRepo.findById(control.getControlOwnerId())
            .map(Owner::getEmail)
            .filter(e -> e != null && !e.isBlank()).orElse(null);
        if (ownerEmail == null) return List.of();
        return List.of(ownerEmail);
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
                        .assignedToUserId(c.getTesterUserId())
                        .assignedToName(c.getTesterName())
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
    public void reassignOpenTasks(Control control) {
        List<ControlTask> open = taskRepo.findByControlId(control.getControlId()).stream()
            .filter(t -> WorkflowStatus.TASK_PENDING.equals(t.getStatus())
                      || WorkflowStatus.TASK_IN_PROGRESS.equals(t.getStatus())
                      || WorkflowStatus.TASK_OVERDUE.equals(t.getStatus()))
            .toList();
        if (open.isEmpty()) return;
        for (ControlTask t : open) {
            t.setAssignedToUserId(control.getTesterUserId());
            t.setAssignedToName(control.getTesterName());
        }
        taskRepo.saveAll(open);
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
            .assignedToUserId(control.getTesterUserId())
            .assignedToName(control.getTesterName())
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
}