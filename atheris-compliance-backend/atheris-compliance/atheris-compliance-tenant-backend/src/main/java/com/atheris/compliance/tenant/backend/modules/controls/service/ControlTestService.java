package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.ControlSchedule;
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
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.email.EmailService;
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
    private final UserRepository userRepo;
    private final EmailService email;

    public List<ControlTestResult> getTestHistory(Integer controlId) {
        return testRepo.findByControlIdOrderByTestDateDesc(controlId);
    }

    public ControlTestResult getTest(Long testId) {
        return testRepo.findById(testId)
            .orElseThrow(() -> ApiException.notFound("Control test not found: " + testId));
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

        ControlTask openTask = currentOpenTask(controlId);
        String reviewSummary = "Control test (" + req.getResult().toLowerCase() + ") on " + safeName(control)
            + " by " + (testerName == null ? "the responsible person" : testerName) + " is waiting for your review";
        Map<String, String> reviewVars = details.messageVars(control, openTask, testerName);
        details.putResult(reviewVars, req.getResult(), null);
        NotificationTemplateService.RenderedEmail review = templates.render(
            EscalationConstants.KEY_CONTROL_DATA_REVIEW, reviewVars);
        String reviewSubject = review.subject() != null ? review.subject()
            : "Review needed: control test on " + safeName(control);
        String reviewBody = review.body() != null ? review.body() : reviewSummary;
        String reviewLink = "/controls/tests/" + result.getTestId() + "/review";
        List<String> reviewCc = ownerCc(control);
        for (String role : List.of(AppRole.ANALYST, AppRole.CCO, AppRole.CONTROL_TEST_REVIEWER)) {
            notifications.notifyRoleEmailed(role, NotificationConstants.CATEGORY_CONTROLS, NotificationConstants.SEVERITY_MEDIUM,
                reviewSummary, reviewLink, reviewSubject, reviewBody, reviewCc, testerUserId);
        }

        audit.log(testerUserId, "control_test_recorded", "control", controlId.longValue(),
            Map.of("result", req.getResult(), "reviewStatus", WorkflowStatus.REVIEW_PENDING));
        return result;
    }

    private ControlTask currentOpenTask(Integer controlId) {
        return taskRepo.findByControlId(controlId).stream()
            .filter(t -> WorkflowStatus.TASK_PENDING.equals(t.getStatus())
                      || WorkflowStatus.TASK_IN_PROGRESS.equals(t.getStatus())
                      || WorkflowStatus.TASK_OVERDUE.equals(t.getStatus()))
            .findFirst().orElse(null);
    }

    private String testerEmail(Control c) {
        if (c.getTesterUserId() != null) {
            String byUser = userRepo.findById(c.getTesterUserId()).map(User::getEmail)
                .filter(e -> e != null && !e.isBlank()).orElse(null);
            if (byUser != null) return byUser;
        }
        if (c.getTesterOwnerId() != null) {
            return ownerRepo.findById(c.getTesterOwnerId()).map(Owner::getEmail)
                .filter(e -> e != null && !e.isBlank()).orElse(null);
        }
        return null;
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

        if (WorkflowStatus.REVIEW_ACCEPTED.equals(decision)) {
            applyAcceptedEffects(t);
        } else {
            ensureOpenTask(t.getControlId());
        }
        ControlTestResult saved = testRepo.save(t);
        notifyTesterOutcome(saved, decision, notes);
        audit.log(reviewer.getUserId(), "test_reviewed", "control_test", testId, Map.of("decision", decision));
        return saved;
    }

    private void applyAcceptedEffects(ControlTestResult t) {
        Control control = controls.findById(t.getControlId()).orElse(null);
        if (control == null) return;
        updateResidualRisk(control, t.getResult());
        boolean failed = WorkflowStatus.TEST_FAILED.equals(t.getResult())
                      || WorkflowStatus.TEST_PARTIAL.equals(t.getResult());
        if (failed) findingService.autoRaiseFromTest(t, control);
        taskRepo.findByControlId(control.getControlId()).stream()
            .filter(task -> WorkflowStatus.TASK_PENDING.equals(task.getStatus())
                         || WorkflowStatus.TASK_IN_PROGRESS.equals(task.getStatus())
                         || WorkflowStatus.TASK_OVERDUE.equals(task.getStatus()))
            .forEach(task -> {
                task.setStatus(WorkflowStatus.TASK_COMPLETED);
                task.setCompletedByTestId(t.getTestId());
                taskRepo.save(task);
            });
        scheduleNextTest(control);
    }

    private void ensureOpenTask(Integer controlId) {
        boolean openTaskExists = taskRepo.findByControlId(controlId).stream()
            .anyMatch(task -> !WorkflowStatus.TASK_COMPLETED.equals(task.getStatus()));
        if (openTaskExists) return;
        controls.findById(controlId).ifPresent(c -> taskRepo.save(ControlTask.builder()
            .controlId(c.getControlId())
            .controlNumber(c.getControlNumber())
            .controlName(c.getName())
            .taskType(WorkflowStatus.TASK_TYPE_SCHEDULED_TEST)
            .assignedToUserId(c.getTesterUserId())
            .assignedToName(c.getTesterName())
            .dueDate(LocalDate.now().plusDays(3))
            .status(WorkflowStatus.TASK_PENDING)
            .escalationLevel(0)
            .build()));
    }

    private void notifyTesterOutcome(ControlTestResult t, String decision, String notes) {
        Control control = controls.findById(t.getControlId()).orElse(null);
        if (control == null) return;
        String to = testerEmail(control);
        if (to == null || to.isBlank()) return;
        Map<String, String> vars = details.messageVars(control, currentOpenTask(control.getControlId()), control.getTesterName());
        details.putResult(vars, t.getResult(), notes);
        String key = WorkflowStatus.REVIEW_ACCEPTED.equals(decision)
            ? EscalationConstants.KEY_CONTROL_TEST_ACCEPTED
            : EscalationConstants.KEY_CONTROL_CHANGES_REQUESTED;
        NotificationTemplateService.RenderedEmail rendered = templates.render(key, vars);
        if (rendered.subject() == null || rendered.body() == null) return;
        email.send(to, List.of(), rendered.subject(), rendered.body(), null);
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
        boolean firstTest = taskRepo.findByControlId(control.getControlId()).isEmpty();
        if (firstTest && control.getFirstDueDate() != null) {
            taskRepo.save(buildTask(control, control.getFirstDueDate()));
            return;
        }
        Integer days = control.getTestFrequencyDays() != null ? control.getTestFrequencyDays()
            : ControlSchedule.daysForFrequency(control.getTestFrequency());
        if (days == null) {
            return;
        }
        taskRepo.save(buildTask(control, LocalDate.now().plus(days, ChronoUnit.DAYS)));
    }

    private ControlTask buildTask(Control control, LocalDate dueDate) {
        return ControlTask.builder()
            .controlId(control.getControlId())
            .controlNumber(control.getControlNumber())
            .controlName(control.getName())
            .taskType(WorkflowStatus.TASK_TYPE_SCHEDULED_TEST)
            .assignedToUserId(control.getTesterUserId())
            .assignedToName(control.getTesterName())
            .dueDate(dueDate)
            .status(WorkflowStatus.TASK_PENDING)
            .escalationLevel(0)
            .build();
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