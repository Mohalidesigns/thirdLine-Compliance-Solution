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
                                                 String q, String frequency, String regulator,
                                                 String act, Pageable p) {
        ensureInstancesForActive();
        catchUpEscalations();

        // When filtering by a specific return, short-circuit
        if (returnId != null) {
            List<ReturnFilingInstance> list = instances.findByReturnId(returnId);
            int start = (int) p.getOffset();
            int end = Math.min(start + p.getPageSize(), list.size());
            List<ReturnFilingInstance> sub = start > list.size() ? List.of() : list.subList(start, end);
            List<ReturnInstanceItem> items = sub.stream().map(inst -> {
                RegulatoryReturn r = returns.findById(inst.getReturnId()).orElse(null);
                return ReturnInstanceItem.from(inst,
                    r != null ? r.getReturnName() : "Unknown",
                    r != null ? regulatorLabel(r) : null,
                    r != null ? r.getActName() : null,
                    r != null ? r.getResponsibleUnit() : null,
                    r != null ? r.getResponsiblePerson() : null);
            }).toList();
            return new PageImpl<>(items, p, list.size());
        }

        // Step 1: Filter RegulatoryReturns first (act, frequency, regulator, q)
        List<RegulatoryReturn> filteredReturns = returns.findByStatus(RegulatoryReturnStatus.ACTIVE);
        if (act != null && !act.isBlank()) {
            String al = act.toLowerCase();
            filteredReturns = filteredReturns.stream().filter(r ->
                r.getActName() != null && r.getActName().toLowerCase().contains(al)
            ).toList();
        }
        if (frequency != null && !frequency.isBlank()) {
            String fl = frequency.toLowerCase();
            filteredReturns = filteredReturns.stream().filter(r ->
                r.getFrequency() != null && r.getFrequency().toLowerCase().contains(fl)
            ).toList();
        }
        if (regulator != null && !regulator.isBlank()) {
            String rl = regulator.toLowerCase();
            filteredReturns = filteredReturns.stream().filter(r ->
                r.getFilingRegulator() != null && r.getFilingRegulator().toLowerCase().contains(rl)
            ).toList();
        }
        if (q != null && !q.isBlank()) {
            String ql = q.toLowerCase();
            filteredReturns = filteredReturns.stream().filter(r ->
                (r.getReturnName() != null && r.getReturnName().toLowerCase().contains(ql)) ||
                (r.getFilingRegulator() != null && r.getFilingRegulator().toLowerCase().contains(ql)) ||
                (r.getActName() != null && r.getActName().toLowerCase().contains(ql))
            ).toList();
        }

        // Step 2: Collect all instances for filtered returns
        java.util.Set<Long> filteredReturnIds = filteredReturns.stream()
            .map(RegulatoryReturn::getReturnId).collect(java.util.stream.Collectors.toSet());
        java.util.Map<Long, RegulatoryReturn> returnMap = filteredReturns.stream()
            .collect(java.util.stream.Collectors.toMap(RegulatoryReturn::getReturnId, r -> r));

        List<ReturnFilingInstance> allInstances = new ArrayList<>();
        for (RegulatoryReturn r : filteredReturns) {
            allInstances.addAll(instances.findByReturnId(r.getReturnId()));
        }

        // Step 3: Apply status filter
        if (status != null && !status.isBlank()) {
            ReturnFilingStatus st;
            try { st = ReturnFilingStatus.fromDb(status); }
            catch (IllegalArgumentException e) { st = null; }
            final ReturnFilingStatus finalSt = st;
            if (finalSt != null) {
                List<ReturnFilingInstance> filtered = allInstances.stream()
                    .filter(i -> finalSt.equals(i.getStatus())).toList();
                allInstances = filtered;
            }
        }

        // Step 4: Sort by due date (newest overdue first, then upcoming)
        allInstances.sort((a, b) -> {
            if (a.getDueDate() == null && b.getDueDate() == null) return 0;
            if (a.getDueDate() == null) return 1;
            if (b.getDueDate() == null) return -1;
            return a.getDueDate().compareTo(b.getDueDate());
        });

        // Step 5: Paginate
        int total = allInstances.size();
        int start = (int) p.getOffset();
        int end = Math.min(start + p.getPageSize(), total);
        List<ReturnFilingInstance> page = start > total ? List.of() : allInstances.subList(start, end);

        // Step 6: Build enriched items
        List<ReturnInstanceItem> items = page.stream().map(inst -> {
            RegulatoryReturn r = returnMap.get(inst.getReturnId());
            if (r == null) r = returns.findById(inst.getReturnId()).orElse(null);
            return ReturnInstanceItem.from(inst,
                r != null ? r.getReturnName() : "Unknown",
                r != null ? regulatorLabel(r) : null,
                r != null ? r.getActName() : null,
                r != null ? r.getResponsibleUnit() : null,
                r != null ? r.getResponsiblePerson() : null);
        }).toList();

        return new PageImpl<>(items, p, total);
    }

    @Transactional
    public Page<ReturnRegisterItem> getRegister(String q, String frequency, String regulator,
                                                 String act, String status, Pageable p) {
        ensureInstancesForActive();
        catchUpEscalations();

        List<RegulatoryReturn> allReturns = returns.findByStatus(RegulatoryReturnStatus.ACTIVE);

        // Apply filters
        if (act != null && !act.isBlank()) {
            String al = act.toLowerCase();
            allReturns = allReturns.stream().filter(r ->
                r.getActName() != null && r.getActName().toLowerCase().contains(al)).toList();
        }
        if (frequency != null && !frequency.isBlank()) {
            String fl = frequency.toLowerCase();
            allReturns = allReturns.stream().filter(r ->
                r.getFrequency() != null && r.getFrequency().toLowerCase().contains(fl)).toList();
        }
        if (regulator != null && !regulator.isBlank()) {
            String rl = regulator.toLowerCase();
            allReturns = allReturns.stream().filter(r ->
                r.getFilingRegulator() != null && r.getFilingRegulator().toLowerCase().contains(rl)).toList();
        }
        if (q != null && !q.isBlank()) {
            String ql = q.toLowerCase();
            allReturns = allReturns.stream().filter(r ->
                (r.getReturnName() != null && r.getReturnName().toLowerCase().contains(ql)) ||
                (r.getFilingRegulator() != null && r.getFilingRegulator().toLowerCase().contains(ql)) ||
                (r.getActName() != null && r.getActName().toLowerCase().contains(ql))).toList();
        }

        LocalDate now = LocalDate.now();
        List<ReturnRegisterItem> items = new ArrayList<>();

        for (RegulatoryReturn r : allReturns) {
            List<ReturnFilingInstance> insts = instances.findByReturnId(r.getReturnId());
            if (insts.isEmpty()) continue;

            // Find current instance: closest non-submitted instance with dueDate >= today,
            // or the most recent submitted/overdue one
            ReturnFilingInstance current = null;
            ReturnFilingInstance closestUpcoming = null;
            for (ReturnFilingInstance i : insts) {
                boolean submitted = ReturnFilingStatus.SUBMITTED.equals(i.getStatus())
                    || ReturnFilingStatus.SUBMITTED_LATE.equals(i.getStatus());
                if (!submitted && i.getDueDate() != null && !i.getDueDate().isBefore(now)) {
                    if (closestUpcoming == null || i.getDueDate().isBefore(closestUpcoming.getDueDate())) {
                        closestUpcoming = i;
                    }
                }
            }
            // If no upcoming, pick the latest instance overall
            if (closestUpcoming == null) {
                closestUpcoming = insts.stream()
                    .max((a, b) -> {
                        if (a.getDueDate() == null) return -1;
                        if (b.getDueDate() == null) return 1;
                        return a.getDueDate().compareTo(b.getDueDate());
                    }).orElse(null);
            }
            current = closestUpcoming;

            if (current == null) continue;

            final ReturnFilingInstance currentInst = current;

            // Status filter on current instance
            if (status != null && !status.isBlank()) {
                String currentStatus = currentInst.getStatus() != null ? currentInst.getStatus().db() : "";
                boolean overdue = !ReturnFilingStatus.SUBMITTED.equals(currentInst.getStatus())
                    && !ReturnFilingStatus.SUBMITTED_LATE.equals(currentInst.getStatus())
                    && currentInst.getDueDate() != null && currentInst.getDueDate().isBefore(now);
                String matchStatus = overdue ? "Overdue" : currentStatus;
                if (!matchStatus.equalsIgnoreCase(status)) continue;
            }

            // Build upcoming instances (next 5 after current)
            List<ReturnFilingInstance> upcoming = insts.stream()
                .filter(i -> i.getDueDate() != null
                    && currentInst.getDueDate() != null
                    && i.getDueDate().isAfter(currentInst.getDueDate()))
                .sorted((a, b) -> a.getDueDate().compareTo(b.getDueDate()))
                .limit(5)
                .toList();

            long overdueCount = insts.stream().filter(i ->
                !ReturnFilingStatus.SUBMITTED.equals(i.getStatus()) &&
                !ReturnFilingStatus.SUBMITTED_LATE.equals(i.getStatus()) &&
                i.getDueDate() != null && i.getDueDate().isBefore(now)).count();

            items.add(ReturnRegisterItem.builder()
                .returnId(r.getReturnId())
                .returnName(r.getReturnName())
                .actName(r.getActName())
                .filingRegulator(r.getFilingRegulator())
                .frequency(r.getFrequency())
                .frequencyType(r.getFrequencyType())
                .responsibleUnit(r.getResponsibleUnit())
                .responsiblePerson(r.getResponsiblePerson())
                .currentPeriod(current.getPeriod())
                .currentDueDate(current.getDueDate())
                .currentStatus(current.getStatus() != null ? current.getStatus().db() : null)
                .currentStage(current.getCurrentStage() != null ? current.getCurrentStage().db() : null)
                .currentInstanceId(current.getInstanceId())
                .upcomingInstances(upcoming.stream().map(i -> ReturnRegisterItem.InstanceSummary.builder()
                    .instanceId(i.getInstanceId())
                    .period(i.getPeriod())
                    .dueDate(i.getDueDate())
                    .status(i.getStatus() != null ? i.getStatus().db() : null)
                    .stage(i.getCurrentStage() != null ? i.getCurrentStage().db() : null)
                    .build()).toList())
                .totalInstances(insts.size())
                .overdueCount((int) overdueCount)
                .hasOverdue(overdueCount > 0)
                .build());
        }

        // Sort by current due date (earliest first)
        items.sort((a, b) -> {
            if (a.getCurrentDueDate() == null) return 1;
            if (b.getCurrentDueDate() == null) return -1;
            return a.getCurrentDueDate().compareTo(b.getCurrentDueDate());
        });

        // Paginate in-memory
        int total = items.size();
        int start = (int) p.getOffset();
        int end = Math.min(start + p.getPageSize(), total);
        List<ReturnRegisterItem> page = start > total ? List.of() : items.subList(start, end);

        return new PageImpl<>(page, p, total);
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
        List<String> actNames = allReturns.stream()
            .map(RegulatoryReturn::getActName).filter(Objects::nonNull)
            .map(String::trim).filter(s -> !s.isBlank())
            .distinct().sorted().toList();

        return ReturnStatsDto.builder()
            .total(allInstances.size())
            .overdue(overdue).inProgress(inProgress).submitted(submitted)
            .frequencies(frequencies).regulators(regulators).actNames(actNames)
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
        PeriodStep step = stepForType(ret.getFrequencyType());
        if (step == null) return; // EVENT_DRIVEN — no instances
        LocalDate today = LocalDate.now();
        LocalDate horizon = today.plusDays(Math.max(lookaheadDays, 1));

        Optional<ReturnFilingInstance> latest = instances.findTopByReturnIdOrderByPeriodDesc(ret.getReturnId());
        LocalDate base = latest.isPresent()
            ? advance(latest.get().getDueDate(), step)
            : today;

        populate(ret, base, step, today, horizon, 0);
    }

    private void populate(RegulatoryReturn ret, LocalDate cursor, PeriodStep step,
                          LocalDate earliest, LocalDate horizon, int depth) {
        if (depth > 365 || cursor.isAfter(horizon)) return;
        if (!cursor.isBefore(earliest)) {
            materialize(ret, cursor, step);
        }
        populate(ret, advance(cursor, step), step, earliest, horizon, depth + 1);
    }

    private void materialize(RegulatoryReturn ret, LocalDate cursor, PeriodStep step) {
        String period;
        LocalDate due;

        if (step.unit() == PeriodUnit.DAY) {
            period = cursor.toString(); // "2026-09-25"
            due = cursor;
        } else if (step.unit() == PeriodUnit.WEEK) {
            int week = cursor.get(java.time.temporal.IsoFields.WEEK_OF_WEEK_BASED_YEAR);
            period = cursor.getYear() + "-W" + String.format("%02d", week); // "2026-W38"
            due = cursor;
        } else {
            // Monthly / Quarterly / Semi-Annual / Annual / Biennial
            period = YearMonth.from(cursor).toString(); // "2026-09"
            if (ret.getFilingDate() != null) {
                int day = Math.min(ret.getFilingDate().getDayOfMonth(), cursor.lengthOfMonth());
                due = cursor.withDayOfMonth(day);
            } else {
                due = cursor.withDayOfMonth(1);
            }
        }

        if (instances.existsByReturnIdAndPeriod(ret.getReturnId(), period)) return;

        int offset = ret.getFilingDeadlineOffsetDays() != null ? ret.getFilingDeadlineOffsetDays() : 5;
        instances.save(ReturnFilingInstance.builder()
            .returnId(ret.getReturnId())
            .period(period).dueDate(due).prepStartDate(due.minusDays(offset))
            .filingChannel(ret.getFilingChannel())
            .currentStage(ReturnStage.NOT_STARTED)
            .status(ReturnFilingStatus.NOT_STARTED).build());
    }

    private enum PeriodUnit { DAY, WEEK, MONTH }
    private record PeriodStep(PeriodUnit unit, int amount) {}

    private PeriodStep stepForType(String frequencyType) {
        if (frequencyType == null) return new PeriodStep(PeriodUnit.MONTH, 1);
        return switch (frequencyType) {
            case "DAILY"       -> new PeriodStep(PeriodUnit.DAY, 1);
            case "WEEKLY"      -> new PeriodStep(PeriodUnit.WEEK, 1);
            case "QUARTERLY"   -> new PeriodStep(PeriodUnit.MONTH, 3);
            case "SEMI_ANNUAL" -> new PeriodStep(PeriodUnit.MONTH, 6);
            case "ANNUAL"      -> new PeriodStep(PeriodUnit.MONTH, 12);
            case "BIENNIAL"    -> new PeriodStep(PeriodUnit.MONTH, 24);
            case "EVENT_DRIVEN" -> null;
            default            -> new PeriodStep(PeriodUnit.MONTH, 1);
        };
    }

    private LocalDate advance(LocalDate date, PeriodStep step) {
        return switch (step.unit()) {
            case DAY   -> date.plusDays(step.amount());
            case WEEK  -> date.plusWeeks(step.amount());
            case MONTH -> date.plusMonths(step.amount());
        };
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