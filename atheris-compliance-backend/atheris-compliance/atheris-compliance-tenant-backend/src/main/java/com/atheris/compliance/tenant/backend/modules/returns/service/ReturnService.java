package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.returns.dto.*;
import com.atheris.compliance.tenant.backend.modules.returns.entity.*;
import com.atheris.compliance.tenant.backend.modules.returns.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class ReturnService {

    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final AuditService audit;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final List<String> STAGES = List.of("Not Started", "Data Gathering", "Draft", "Review", "Sign-off", "Submitted");

    public Page<ReturnInstanceItem> getCalendar(String period, Long returnId, String status, Pageable p) {
        Page<ReturnFilingInstance> page;
        if (returnId != null) {
            List<ReturnFilingInstance> list = instances.findByReturnId(returnId);
            int start = (int) p.getOffset();
            int end = Math.min(start + p.getPageSize(), list.size());
            List<ReturnFilingInstance> sub = start > list.size() ? List.of() : list.subList(start, end);
            page = new PageImpl<>(sub, p, list.size());
        } else if (status != null && !status.isEmpty()) {
            page = instances.findByStatus(status, p);
        } else {
            page = instances.findByDueDateBetweenOrderByDueDateAsc(LocalDate.now(), LocalDate.now().plusDays(90), p);
        }
        return page.map(inst -> {
            RegulatoryReturn r = returns.findById(inst.getReturnId()).orElse(null);
            return ReturnInstanceItem.from(inst,
                r != null ? r.getReturnName() : "Unknown",
                r != null ? r.getFilingRegulator() : null);
        });
    }

    public ReturnInstanceDetailResponse getDetail(Long instanceId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> new RuntimeException("Instance not found: " + instanceId));
        RegulatoryReturn r = returns.findById(inst.getReturnId())
            .orElseThrow(() -> new RuntimeException("Return not found: " + inst.getReturnId()));
        return ReturnInstanceDetailResponse.from(inst, r.getReturnName(), r.getFilingRegulator(), r.getReturnOwnerName());
    }

    @Transactional
    public void advanceStage(Long instanceId, AdvanceStageRequest req, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> new RuntimeException("Not found"));
        int idx = STAGES.indexOf(inst.getCurrentStage());
        if (idx < 0 || idx >= STAGES.size() - 1)
            throw new RuntimeException("Cannot advance from: " + inst.getCurrentStage());
        String next = STAGES.get(idx + 1);

        Map<String, Map<String, String>> stageData = parseStageData(inst.getStageData());
        Map<String, String> stageEntry = new HashMap<>();
        stageEntry.put("completedAt", Instant.now().toString());
        stageEntry.put("completedByUserId", String.valueOf(userId));
        if (req.getCompletedByName() != null) stageEntry.put("completedByName", req.getCompletedByName());
        if (req.getEvidenceUrl() != null) stageEntry.put("evidenceUrl", req.getEvidenceUrl());
        stageData.put(inst.getCurrentStage(), stageEntry);
        try {
            inst.setStageData(MAPPER.writeValueAsString(stageData));
        } catch (Exception e) { throw new RuntimeException("Failed to serialize stage data", e); }

        inst.setCurrentStage(next);
        inst.setStatus("In Progress");
        inst.setStageOwnerUserId(userId);
        instances.save(inst);
        audit.log(userId, "return_stage_advanced", "return_instance", instanceId,
            Map.of("from", STAGES.get(idx), "to", next));
    }

    @Transactional
    public void submit(Long instanceId, String evidenceUrl, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId).orElseThrow();
        LocalDate today = LocalDate.now();
        boolean late = today.isAfter(inst.getDueDate());
        int daysLate = late ? (int) ChronoUnit.DAYS.between(inst.getDueDate(), today) : 0;

        Map<String, Map<String, String>> stageData = parseStageData(inst.getStageData());
        Map<String, String> stageEntry = new HashMap<>();
        stageEntry.put("completedAt", Instant.now().toString());
        stageEntry.put("completedByUserId", String.valueOf(userId));
        if (evidenceUrl != null) stageEntry.put("evidenceUrl", evidenceUrl);
        stageData.put("Sign-off", stageEntry);
        try {
            inst.setStageData(MAPPER.writeValueAsString(stageData));
        } catch (Exception e) { throw new RuntimeException("Failed to serialize stage data", e); }

        inst.setCurrentStage("Submitted");
        inst.setStatus(late ? "Submitted Late" : "Submitted");
        inst.setSubmittedDate(today);
        inst.setSubmittedByUserId(userId);
        inst.setSubmissionEvidenceUrl(evidenceUrl);
        inst.setDaysLate(daysLate);
        instances.save(inst);
        audit.log(userId, "return_submitted", "return_instance", instanceId, Map.of("days_late", daysLate));
    }

    @Transactional
    public RegulatoryReturn create(CreateReturnRequest req, Integer userId) {
        RegulatoryReturn r = RegulatoryReturn.builder()
            .returnName(req.getReturnName()).filingRegulator(req.getFilingRegulator())
            .returnType(req.getReturnType()).frequency(req.getFrequency())
            .filingDueDayOfMonth(req.getFilingDueDayOfMonth())
            .filingDeadlineOffsetDays(req.getFilingDeadlineOffsetDays())
            .filingChannel(req.getFilingChannel())
            .returnOwnerUserId(req.getReturnOwnerUserId())
            .returnOwnerName(req.getReturnOwnerName()).build();
        RegulatoryReturn saved = returns.save(r);
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
            .dueDate(nextDue).prepStartDate(nextDue.minusDays(offset))
            .filingChannel(ret.getFilingChannel())
            .currentStage("Not Started").status("Not Started").build());
    }

    private Map<String, Map<String, String>> parseStageData(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return MAPPER.readValue(json, HashMap.class);
        } catch (Exception e) { return new HashMap<>(); }
    }
}
