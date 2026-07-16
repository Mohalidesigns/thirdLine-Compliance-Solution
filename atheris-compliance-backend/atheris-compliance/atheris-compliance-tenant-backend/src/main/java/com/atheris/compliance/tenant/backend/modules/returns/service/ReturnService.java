package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.returns.entity.*;
import com.atheris.compliance.tenant.backend.modules.returns.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ReturnService {

    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final AuditService audit;

    private static final List<String> STAGES = List.of("Not Started", "Data Gathering", "Draft", "Review", "Sign-off", "Submitted");

    public List<RegulatoryReturn> findAll() {
        return returns.findByStatus("Active");
    }

    public List<ReturnFilingInstance> getCalendar(int days) {
        return instances.findByDueDateBetweenOrderByDueDateAsc(LocalDate.now(), LocalDate.now().plusDays(days));
    }

    public List<ReturnFilingInstance> getOverdue() {
        return instances.findByStatusNotInAndDueDateBefore(List.of("Submitted", "Submitted Late"), LocalDate.now());
    }

    public List<ReturnFilingInstance> getInstances(Long returnId) {
        return instances.findByReturnId(returnId);
    }

    @Transactional
    public ReturnFilingInstance advanceStage(Long instanceId, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> new RuntimeException("Not found"));
        int idx = STAGES.indexOf(inst.getCurrentStage());
        if (idx < 0 || idx >= STAGES.size() - 1)
            throw new RuntimeException("Cannot advance from: " + inst.getCurrentStage());
        String next = STAGES.get(idx + 1);
        inst.setCurrentStage(next);
        inst.setStatus("In Progress");
        inst.setStageOwnerUserId(userId);
        audit.log(userId, "return_stage_advanced", "return_instance", instanceId, Map.of("next_stage", next));
        return instances.save(inst);
    }

    @Transactional
    public ReturnFilingInstance submit(Long instanceId, String evidenceUrl, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId).orElseThrow();
        LocalDate today = LocalDate.now();
        boolean late = today.isAfter(inst.getDueDate());
        int daysLate = late ? (int) ChronoUnit.DAYS.between(inst.getDueDate(), today) : 0;
        inst.setCurrentStage("Submitted");
        inst.setStatus(late ? "Submitted Late" : "Submitted");
        inst.setSubmittedDate(today);
        inst.setSubmittedByUserId(userId);
        inst.setSubmissionEvidenceUrl(evidenceUrl);
        inst.setDaysLate(daysLate);
        audit.log(userId, "return_submitted", "return_instance", instanceId, Map.of("days_late", daysLate));
        return instances.save(inst);
    }

    @Transactional
    public RegulatoryReturn create(RegulatoryReturn req, Integer userId) {
        RegulatoryReturn saved = returns.save(req);
        createNextInstance(saved);
        audit.log(userId, "return_created", "return", saved.getReturnId(), Map.of("name", saved.getReturnName()));
        return saved;
    }

    private void createNextInstance(RegulatoryReturn ret) {
        if (ret.getFilingDueDayOfMonth() == null) return;
        LocalDate nextDue = LocalDate.now().withDayOfMonth(ret.getFilingDueDayOfMonth()).plusMonths(1);
        int offset = ret.getFilingDeadlineOffsetDays() != null ? ret.getFilingDeadlineOffsetDays() : 5;
        instances.save(ReturnFilingInstance.builder()
            .returnId(ret.getReturnId())
            .period(nextDue.getYear() + "-" + String.format("%02d", nextDue.getMonthValue()))
            .dueDate(nextDue)
            .prepStartDate(nextDue.minusDays(offset))
            .currentStage("Not Started")
            .status("Not Started").build());
    }
}
