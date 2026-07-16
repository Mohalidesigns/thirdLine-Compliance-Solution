package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.modules.controls.dto.RecordTestRequest;
import com.atheris.compliance.tenant.backend.modules.controls.entity.*;
import com.atheris.compliance.tenant.backend.modules.controls.repository.*;
import com.atheris.compliance.tenant.backend.modules.findings.service.FindingService;
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

    private final ControlTestResultRepository testRepo;
    private final ControlTaskRepository taskRepo;
    private final ControlRepository controls;
    private final FindingService findingService;
    private final AuditService audit;

    public List<ControlTestResult> getTestHistory(Integer controlId) {
        return testRepo.findByControlIdOrderByTestDateDesc(controlId);
    }

    public List<ControlTestResult> getPendingReview() {
        return testRepo.findByReviewStatus("Pending");
    }

    public List<ControlTask> getTasksForUser(Integer userId) {
        return taskRepo.findByAssignedToUserIdAndStatusIn(userId, List.of("Pending", "In Progress", "Overdue"));
    }

    public List<ControlTask> getAllOverdue() {
        return taskRepo.findByStatusAndDueDateBefore("Pending", LocalDate.now());
    }

    @Transactional
    public ControlTestResult recordTest(Integer controlId, RecordTestRequest req, User tester) {
        Control control = controls.findById(controlId)
            .orElseThrow(() -> new RuntimeException("Control not found: " + controlId));
        ControlTestResult result = ControlTestResult.builder()
            .controlId(controlId).testDate(req.getTestDate())
            .testedByUserId(tester.getUserId()).testedByName(tester.getFullName())
            .result(req.getResult()).resultDescription(req.getResultDescription())
            .failureDetails(req.getFailureDetails()).failureSeverity(req.getFailureSeverity())
            .evidenceUrl(req.getEvidenceUrl()).remediationRequired(req.getRemediationRequired())
            .remediationOwnerUserId(req.getRemediationOwnerUserId())
            .remediationDeadline(req.getRemediationDeadline())
            .reviewStatus("Pending").build();
        testRepo.save(result);
        updateResidualRisk(control, req.getResult());
        if ("Failed".equals(req.getResult()) || "Partial".equals(req.getResult()))
            findingService.autoRaiseFromTest(result, control);
        taskRepo.findByControlId(controlId).stream()
            .filter(t -> "Pending".equals(t.getStatus()) || "In Progress".equals(t.getStatus()))
            .forEach(t -> {
                t.setStatus("Completed");
                t.setCompletedByTestId(result.getTestId());
                taskRepo.save(t);
            });
        audit.log(tester.getUserId(), "control_test_recorded", "control", controlId.longValue(),
            Map.of("result", req.getResult()));
        return result;
    }

    @Transactional
    public ControlTestResult reviewTest(Long testId, String decision, String notes, User reviewer) {
        ControlTestResult t = testRepo.findById(testId).orElseThrow();
        if (!"Accepted".equals(decision) && !"Rejected".equals(decision))
            throw new RuntimeException("Decision must be Accepted or Rejected");
        t.setReviewedByUserId(reviewer.getUserId());
        t.setReviewedByName(reviewer.getFullName());
        t.setReviewStatus(decision);
        t.setReviewNotes(notes);
        t.setReviewedAt(Instant.now());
        audit.log(reviewer.getUserId(), "test_reviewed", "control_test", testId, Map.of("decision", decision));
        return testRepo.save(t);
    }

    @Transactional
    public void scheduleNextTest(Control control) {
        if (control.getTestFrequencyDays() == null) return;
        LocalDate nextDue = LocalDate.now().plus(control.getTestFrequencyDays(), ChronoUnit.DAYS);
        taskRepo.save(ControlTask.builder()
            .controlId(control.getControlId())
            .controlNumber(control.getControlNumber())
            .controlName(control.getName())
            .taskType("scheduled_test")
            .assignedToUserId(control.getControlOwnerUserId())
            .assignedToName(control.getControlOwnerName())
            .dueDate(nextDue).status("Pending").build());
    }

    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void processOverdueTasks() {
        List<ControlTask> overdue = taskRepo.findByStatusAndDueDateBefore("Pending", LocalDate.now());
        for (ControlTask t : overdue) {
            t.setStatus("Overdue");
            taskRepo.save(t);
        }
        log.info("Marked {} tasks as overdue", overdue.size());
        taskRepo.findByStatusAndDueDateBefore("Pending", LocalDate.now().minusDays(2)).forEach(t -> {
            if (t.getEscalationLevel() < 1) {
                t.setEscalationLevel(1);
                t.setEscalatedAt(Instant.now());
                taskRepo.save(t);
                log.info("Task {} escalated to manager", t.getTaskId());
            }
        });
        taskRepo.findByStatusAndDueDateBefore("Pending", LocalDate.now().minusDays(5)).forEach(t -> {
            if (t.getEscalationLevel() < 2) {
                t.setEscalationLevel(2);
                taskRepo.save(t);
                log.info("Task {} escalated to CCO", t.getTaskId());
            }
        });
    }

    private void updateResidualRisk(Control c, String result) {
        String risk = switch (result) {
            case "Passed" -> "Low";
            case "Partial" -> "Medium";
            case "Failed" -> c.getInherentRisk();
            default -> c.getResidualRisk();
        };
        c.setResidualRisk(risk);
        controls.save(c);
    }
}
