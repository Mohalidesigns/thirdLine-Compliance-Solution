package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.returns.dto.*;
import com.atheris.compliance.tenant.backend.modules.returns.entity.*;
import com.atheris.compliance.tenant.backend.modules.returns.repository.*;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class ReturnService {

    private static final int SYSTEM_USER_ID = 0;
    private static final int ESCALATION_CAP = 3;
    private static final List<ReturnStage> STAGES = List.of(ReturnStage.values());

    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final TenantRegulatorRepository regulators;
    private final ObligationRepository obligations;
    private final AuditService audit;
    private final TenantIdentityService tenantIdentity;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Value("${atheris.returns.instance-lookahead-days:120}")
    private int lookaheadDays;

    @Value("${atheris.returns.escalation-thresholds:2,5}")
    private String escalationThresholds;

    private List<Integer> thresholds() {
        List<Integer> out = new ArrayList<>();
        if (escalationThresholds != null)
            for (String t : escalationThresholds.split(",")) {
                String s = t.trim();
                if (!s.isEmpty()) try { out.add(Integer.parseInt(s)); } catch (NumberFormatException ignored) {}
            }
        return out;
    }

    @Transactional
    public Page<ReturnInstanceItem> getCalendar(String period, Long returnId, String status,
                                                 String q, String frequency, String regulator, Pageable p) {
        ensureInstancesForActive();
        catchUpEscalations();
        Page<ReturnFilingInstance> page;
        if (returnId != null) {
            List<ReturnFilingInstance> list = instances.findByReturnId(returnId);
            int start = (int) p.getOffset();
            int end = Math.min(start + p.getPageSize(), list.size());
            List<ReturnFilingInstance> sub = start > list.size() ? List.of() : list.subList(start, end);
            page = new PageImpl<>(sub, p, list.size());
        } else if (status != null && !status.isEmpty()) {
            ReturnFilingStatus st;
            try { st = ReturnFilingStatus.fromDb(status); }
            catch (IllegalArgumentException e) { st = null; }
            page = st != null ? instances.findByStatus(st, p) : Page.empty(p);
        } else {
            page = instances.findByDueDateBetweenOrderByDueDateAsc(
                LocalDate.now().minusDays(60), LocalDate.now().plusDays(90), p);
        }
        // Build enriched list then apply q/frequency/regulator filters in-memory
        List<ReturnInstanceItem> items = page.map(inst -> {
            RegulatoryReturn r = returns.findById(inst.getReturnId()).orElse(null);
            return ReturnInstanceItem.from(inst,
                r != null ? r.getReturnName() : "Unknown",
                r != null ? regulatorLabel(r) : null,
                r != null ? r.getActName() : null,
                r != null ? r.getResponsibleUnit() : null,
                r != null ? r.getResponsiblePerson() : null);
        }).getContent();

        if (q != null && !q.isBlank()) {
            String ql = q.toLowerCase();
            items = items.stream().filter(i ->
                (i.getReturnName() != null && i.getReturnName().toLowerCase().contains(ql)) ||
                (i.getFilingRegulator() != null && i.getFilingRegulator().toLowerCase().contains(ql))
            ).toList();
        }
        if (frequency != null && !frequency.isBlank()) {
            String fl = frequency.toLowerCase();
            items = items.stream().filter(i -> {
                RegulatoryReturn r = returns.findById(i.getReturnId()).orElse(null);
                return r != null && r.getFrequency() != null && r.getFrequency().toLowerCase().contains(fl);
            }).toList();
        }
        if (regulator != null && !regulator.isBlank()) {
            String rl = regulator.toLowerCase();
            items = items.stream().filter(i ->
                i.getFilingRegulator() != null && i.getFilingRegulator().toLowerCase().contains(rl)
            ).toList();
        }

        int start = (int) p.getOffset();
        int end = Math.min(start + p.getPageSize(), items.size());
        List<ReturnInstanceItem> sub = start > items.size() ? List.of() : items.subList(start, end);
        return new PageImpl<>(sub, p, items.size());
    }

    public ReturnStatsDto getStats() {
        List<RegulatoryReturn> allReturns = returns.findByStatus(RegulatoryReturnStatus.ACTIVE);
        List<ReturnFilingInstance> allInstances = new ArrayList<>();
        for (RegulatoryReturn r : allReturns) {
            allInstances.addAll(instances.findByReturnId(r.getReturnId()));
        }
        LocalDate now = LocalDate.now();
        long overdue = allInstances.stream().filter(i ->
            !ReturnFilingStatus.SUBMITTED.equals(i.getStatus()) &&
            !ReturnFilingStatus.SUBMITTED_LATE.equals(i.getStatus()) &&
            i.getDueDate() != null && i.getDueDate().isBefore(now)).count();
        long inProgress = allInstances.stream().filter(i ->
            ReturnFilingStatus.IN_PROGRESS.equals(i.getStatus())).count();
        long submitted = allInstances.stream().filter(i ->
            ReturnFilingStatus.SUBMITTED.equals(i.getStatus()) ||
            ReturnFilingStatus.SUBMITTED_LATE.equals(i.getStatus())).count();

        List<String> frequencies = allReturns.stream()
            .map(RegulatoryReturn::getFrequency).filter(Objects::nonNull)
            .map(String::trim).filter(s -> !s.isBlank())
            .distinct().sorted().toList();
        List<String> regulators = allReturns.stream()
            .map(RegulatoryReturn::getFilingRegulator).filter(Objects::nonNull)
            .map(String::trim).filter(s -> !s.isBlank())
            .distinct().sorted().toList();

        return ReturnStatsDto.builder()
            .total(allInstances.size())
            .overdue(overdue).inProgress(inProgress).submitted(submitted)
            .frequencies(frequencies).regulators(regulators)
            .build();
    }

    @Transactional
    public ReturnInstanceDetailResponse getDetail(Long instanceId) {
        Long returnId = instances.findById(instanceId)
            .orElseThrow(() -> new RuntimeException("Instance not found: " + instanceId)).getReturnId();
        RegulatoryReturn r = returns.findById(returnId)
            .orElseThrow(() -> new RuntimeException("Return not found: " + returnId));
        ensureInstances(r);
        catchUpEscalations();
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> new RuntimeException("Instance not found: " + instanceId));
        return ReturnInstanceDetailResponse.from(inst, r.getReturnName(), regulatorLabel(r), r.getReturnOwnerName());
    }

    public List<RegulatoryReturn> listActive() {
        return returns.findByStatus(RegulatoryReturnStatus.ACTIVE);
    }

    @Transactional
    public void advanceStage(Long instanceId, AdvanceStageRequest req, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> new RuntimeException("Not found"));
        int idx = STAGES.indexOf(inst.getCurrentStage());
        if (idx < 0 || idx >= STAGES.size() - 1)
            throw new RuntimeException("Cannot advance from: " + inst.getCurrentStage());
        ReturnStage next = STAGES.get(idx + 1);

        Map<String, Map<String, String>> stageData = parseStageData(inst.getStageData());
        Map<String, String> stageEntry = new HashMap<>();
        stageEntry.put("completedAt", Instant.now().toString());
        stageEntry.put("completedByUserId", String.valueOf(userId));
        if (req.getCompletedByName() != null) stageEntry.put("completedByName", req.getCompletedByName());
        if (req.getEvidenceUrl() != null) stageEntry.put("evidenceUrl", req.getEvidenceUrl());
        stageData.put(inst.getCurrentStage().db(), stageEntry);
        try {
            inst.setStageData(MAPPER.writeValueAsString(stageData));
        } catch (Exception e) { throw new RuntimeException("Failed to serialize stage data", e); }

        inst.setCurrentStage(next);
        inst.setStatus(ReturnFilingStatus.IN_PROGRESS);
        inst.setStageOwnerUserId(userId);
        instances.save(inst);
        audit.log(userId, "return_stage_advanced", "return_instance", instanceId,
            Map.of("from", STAGES.get(idx).db(), "to", next.db()));
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

        inst.setCurrentStage(ReturnStage.SUBMITTED);
        inst.setStatus(late ? ReturnFilingStatus.SUBMITTED_LATE : ReturnFilingStatus.SUBMITTED);
        inst.setSubmittedDate(today);
        inst.setSubmittedByUserId(userId);
        inst.setSubmissionEvidenceUrl(evidenceUrl);
        inst.setDaysLate(daysLate);
        inst.setEscalationLevel(0);
        inst.setEscalatedAt(null);
        instances.save(inst);
        audit.log(userId, "return_submitted", "return_instance", instanceId,
            Collections.singletonMap("days_late", daysLate));
    }

    @Transactional
    public RegulatoryReturn create(CreateReturnRequest req, Integer userId) {
        Long tenantId = tenantIdentity.currentTenantId();
        TenantRegulator reg = req.getTenantRegulatorId() != null
            ? regulators.findByIdAndTenantId(req.getTenantRegulatorId(), tenantId).orElse(null)
            : null;
        String snapshot = req.getFilingRegulator();
        if ((snapshot == null || snapshot.isBlank()) && reg != null)
            snapshot = reg.getAbbreviation() != null ? reg.getAbbreviation() : reg.getName();
        if (snapshot == null || snapshot.isBlank()) snapshot = "Unknown";

        RegulatoryReturn r = RegulatoryReturn.builder()
            .returnName(req.getReturnName()).filingRegulator(snapshot)
            .tenantRegulatorId(reg != null ? reg.getId() : req.getTenantRegulatorId())
            .actId(req.getActId())
            .returnType(req.getReturnType()).frequency(req.getFrequency())
            .filingDate(req.getFilingDate())
            .filingDeadlineOffsetDays(req.getFilingDeadlineOffsetDays())
            .filingChannel(req.getFilingChannel())
            .returnOwnerUserId(req.getReturnOwnerUserId())
            .returnOwnerName(req.getReturnOwnerName())
            .responsibleUnit(req.getResponsibleUnit())
            .responsiblePerson(req.getResponsiblePerson()).build();
        RegulatoryReturn saved = returns.save(r);
        ensureInstances(saved);
        audit.log(userId, "return_created", "return", saved.getReturnId(),
            Collections.singletonMap("name", saved.getReturnName()));
        return saved;
    }

    @Transactional
    public void linkObligations(Long returnId, List<Long> obligationIds, Integer userId) {
        if (!returns.existsById(returnId))
            throw new RuntimeException("Return not found: " + returnId);
        obligations.deleteObligationLinks(returnId);
        if (obligationIds != null) {
            for (Long oid : new LinkedHashSet<>(obligationIds)) {
                if (!obligations.existsById(oid))
                    throw new RuntimeException("Obligation not found: " + oid);
                obligations.insertReturnLink(oid, returnId);
            }
        }
        audit.log(userId, "link_obligations", "return", returnId,
            Collections.singletonMap("obligationIds", obligationIds));
    }

    public List<Long> linkedObligationIds(Long returnId) {
        return obligations.findLinkedObligationIds(returnId);
    }

    private void ensureInstancesForActive() {
        for (RegulatoryReturn r : returns.findByStatus(RegulatoryReturnStatus.ACTIVE)) {
            try { ensureInstances(r); }
            catch (Exception e) { log.warn("ensureInstances failed for return {}: {}", r.getReturnId(), e.getMessage()); }
        }
    }

    private void ensureInstances(RegulatoryReturn ret) {
        int step = Math.max(1, monthsPerPeriod(ret.getFrequency()));
        LocalDate today = LocalDate.now();
        LocalDate earliest = today.minusDays(60);
        LocalDate horizon = today.plusDays(Math.max(lookaheadDays, 1));
        YearMonth startYM = YearMonth.from(earliest);
        YearMonth endYM = YearMonth.from(horizon);

        Optional<ReturnFilingInstance> latest = instances.findTopByReturnIdOrderByPeriodDesc(ret.getReturnId());
        YearMonth base = latest.isPresent()
            ? YearMonth.from(latest.get().getDueDate()).plusMonths(step)
            : YearMonth.from(today);

        populate(ret, base, step, earliest, horizon, startYM, endYM, 0, true);
        if (latest.isEmpty())
            populate(ret, base.minusMonths(step), step, earliest, horizon, startYM, endYM, 0, false);
    }

    private void populate(RegulatoryReturn ret, YearMonth cursor, int step,
                          LocalDate earliest, LocalDate horizon,
                          YearMonth startYM, YearMonth endYM, int depth, boolean forward) {
        if (depth > 60 || cursor.isBefore(startYM) || cursor.isAfter(endYM)) return;
        materialize(ret, cursor, earliest, horizon);
        YearMonth next = forward ? cursor.plusMonths(step) : cursor.minusMonths(step);
        populate(ret, next, step, earliest, horizon, startYM, endYM, depth + 1, forward);
    }

    private void materialize(RegulatoryReturn ret, YearMonth ym, LocalDate earliest, LocalDate horizon) {
        LocalDate due = ret.getFilingDate() != null
            ? ret.getFilingDate()
            : safeDueDate(ym, null);
        if (due.isBefore(earliest) || due.isAfter(horizon)) return;
        String period = ym.toString();
        if (instances.existsByReturnIdAndPeriod(ret.getReturnId(), period)) return;
        int offset = ret.getFilingDeadlineOffsetDays() != null ? ret.getFilingDeadlineOffsetDays() : 5;
        instances.save(ReturnFilingInstance.builder()
            .returnId(ret.getReturnId())
            .period(period).dueDate(due).prepStartDate(due.minusDays(offset))
            .filingChannel(ret.getFilingChannel())
            .currentStage(ReturnStage.NOT_STARTED)
            .status(ReturnFilingStatus.NOT_STARTED).build());
    }

    private LocalDate safeDueDate(YearMonth ym, Integer dueDay) {
        int day = dueDay == null ? 1 : Math.min(dueDay, ym.lengthOfMonth());
        return ym.atDay(day);
    }

    private int monthsPerPeriod(String frequency) {
        if (frequency == null) return 1;
        String f = frequency.trim().toLowerCase();
        if (f.contains("annual")) return 12;
        if (f.contains("semi")) return 6;
        if (f.contains("quarter")) return 3;
        return 1;
    }

    private void catchUpEscalations() {
        for (ReturnFilingInstance inst : instances.findByStatusNotInAndDueDateBefore(
                List.of(ReturnFilingStatus.SUBMITTED, ReturnFilingStatus.SUBMITTED_LATE), LocalDate.now())) {
            try {
                long days = ChronoUnit.DAYS.between(inst.getDueDate(), LocalDate.now());
                int implied = impliedEscalation(days);
                int current = inst.getEscalationLevel() != null ? inst.getEscalationLevel() : 0;
                if (implied > current) {
                    inst.setEscalationLevel(implied);
                    inst.setEscalatedAt(Instant.now());
                    instances.save(inst);
                    audit.log(SYSTEM_USER_ID, "return_escalated", "return_instance", inst.getInstanceId(),
                        Collections.singletonMap("level", implied));
                    log.info("Escalated return instance {} to level {}", inst.getInstanceId(), implied);
                }
            } catch (Exception e) {
                log.warn("Escalation check failed for instance {}: {}", inst.getInstanceId(), e.getMessage());
            }
        }
    }

    private int impliedEscalation(long daysLate) {
        if (daysLate <= 0) return 0;
        int level = 1;
        for (int t : thresholds()) if (daysLate > t) level++;
        return Math.min(level, ESCALATION_CAP);
    }

    private String regulatorLabel(RegulatoryReturn ret) {
        if (ret.getFilingRegulator() != null && !ret.getFilingRegulator().isBlank())
            return ret.getFilingRegulator();
        if (ret.getTenantRegulatorId() != null) {
            return regulators.findByIdAndTenantId(ret.getTenantRegulatorId(), tenantIdentity.currentTenantId())
                .map(tr -> tr.getAbbreviation() != null ? tr.getAbbreviation() : tr.getName())
                .orElse(null);
        }
        return null;
    }

    private Map<String, Map<String, String>> parseStageData(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return MAPPER.readValue(json, HashMap.class);
        } catch (Exception e) { return new HashMap<>(); }
    }
}