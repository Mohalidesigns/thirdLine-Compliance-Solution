package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService;
import com.atheris.compliance.tenant.backend.modules.returns.dto.*;
import com.atheris.compliance.tenant.backend.modules.returns.entity.*;
import com.atheris.compliance.tenant.backend.modules.returns.repository.*;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.util.*;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class ReturnService {

    private static final int SYSTEM_USER_ID = 0;
    private static final int ESCALATION_CAP = 3;
    private static final List<ReturnStage> STAGES = List.of(ReturnStage.values());
    /** Register status filter value for returns with no due rule. */
    public static final String STATUS_DUE_DATE_NEEDED = "Due date needed";

    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final TenantRegulatorRepository regulators;
    private final ObligationRepository obligations;
    private final AuditService audit;
    private final TenantIdentityService tenantIdentity;
    private final ObligationService obligationService;
    private final UntouchedInstances untouched;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @PersistenceContext
    private EntityManager em;

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

    @Scheduled(fixedDelay = 300000)
    void scheduledMaintenance() {
        try { ensureInstancesForActive(); } catch (Exception e) { log.warn("Scheduled ensureInstances failed: {}", e.getMessage()); }
        try { catchUpEscalations(); } catch (Exception e) { log.warn("Scheduled catchUpEscalations failed: {}", e.getMessage()); }
    }

    @Transactional
    public Page<ReturnInstanceItem> getCalendar(String period, Long returnId, String status,
                                                 String q, String frequency, String regulator,
                                                 String act, Pageable p) {

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
            filteredReturns = filteredReturns.stream().filter(r -> matchesFrequency(r, frequency)).toList();
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

        Map<Long, List<ReturnFilingInstance>> instsByReturn = instances.findByReturnIdIn(filteredReturnIds).stream()
            .collect(Collectors.groupingBy(ReturnFilingInstance::getReturnId));

        List<ReturnFilingInstance> allInstances = new ArrayList<>();
        for (RegulatoryReturn r : filteredReturns) {
            allInstances.addAll(instsByReturn.getOrDefault(r.getReturnId(), List.of()));
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

        List<RegulatoryReturn> allReturns = returns.findByStatus(RegulatoryReturnStatus.ACTIVE);

        // Apply filters
        if (act != null && !act.isBlank()) {
            String al = act.toLowerCase();
            allReturns = allReturns.stream().filter(r ->
                r.getActName() != null && r.getActName().toLowerCase().contains(al)).toList();
        }
        if (frequency != null && !frequency.isBlank()) {
            allReturns = allReturns.stream().filter(r -> matchesFrequency(r, frequency)).toList();
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

        Set<Long> returnIds = allReturns.stream().map(RegulatoryReturn::getReturnId).collect(Collectors.toSet());
        List<ReturnFilingInstance> allInsts = instances.findByReturnIdIn(returnIds);
        Map<Long, List<ReturnFilingInstance>> instsByReturn = allInsts.stream()
            .collect(Collectors.groupingBy(ReturnFilingInstance::getReturnId));

        List<ReturnRegisterItem> items = new ArrayList<>();
        boolean filterStatus = status != null && !status.isBlank();
        boolean dueDateNeededFilter = filterStatus && STATUS_DUE_DATE_NEEDED.equalsIgnoreCase(status.trim());

        for (RegulatoryReturn r : allReturns) {
            List<ReturnFilingInstance> insts = instsByReturn.getOrDefault(r.getReturnId(), List.of());
            ReturnRegisterItem item = buildRegisterItem(r, insts, now);
            if (item == null) continue;
            if (dueDateNeededFilter) {
                if (!item.isDueDateNeeded()) continue;
            } else if (filterStatus) {
                // Event-driven / not materialised / due date needed rows have no status: any status filter excludes them.
                if (item.getCurrentInstanceId() == null) continue;
                String matchStatus = item.getCurrentDueDate() != null && item.getCurrentDueDate().isBefore(now)
                    && !isSubmitted(item.getCurrentStatus()) ? "Overdue"
                    : (item.getCurrentStatus() != null ? item.getCurrentStatus() : "");
                if (!matchStatus.equalsIgnoreCase(status)) continue;
            }
            items.add(item);
        }

        // Sort by current due date (earliest first)
        items.sort(Comparator.comparing(ReturnRegisterItem::getCurrentDueDate,
            Comparator.nullsLast(Comparator.naturalOrder())));

        // Paginate in-memory
        int total = items.size();
        int start = (int) p.getOffset();
        int end = Math.min(start + p.getPageSize(), total);
        List<ReturnRegisterItem> page = start > total ? List.of() : items.subList(start, end);

        return new PageImpl<>(page, p, total);
    }

    private static boolean isSubmitted(String status) {
        return ReturnFilingStatus.SUBMITTED.db().equalsIgnoreCase(status)
            || ReturnFilingStatus.SUBMITTED_LATE.db().equalsIgnoreCase(status);
    }

    /**
     * One register row: the return's schedule fields plus its current instance (closest non-submitted one
     * due today or later, else the latest) and the next five. A return without instances (event-driven, not
     * materialised yet, or due date needed) is listed without a current period/status.
     */
    private ReturnRegisterItem buildRegisterItem(RegulatoryReturn r, List<ReturnFilingInstance> insts, LocalDate now) {
        DueRule rule = DueRule.of(r);
        ReturnRegisterItem.ReturnRegisterItemBuilder b = ReturnRegisterItem.builder()
            .returnId(r.getReturnId())
            .returnName(r.getReturnName())
            .actName(r.getActName())
            .filingRegulator(r.getFilingRegulator())
            .frequency(r.getFrequency())
            .frequencyType(r.getFrequencyType())
            .responsibleUnit(r.getResponsibleUnit())
            .responsiblePerson(r.getResponsiblePerson())
            .dueDateNeeded(DueRule.dueDateNeeded(r))
            .dueRuleType(rule != null ? rule.kind().name() : null)
            .firstDueDate(rule != null && rule.kind() == DueRule.Kind.DATE ? rule.firstDueDate() : null)
            .daysAfterPeriodEnd(rule != null && rule.kind() == DueRule.Kind.OFFSET ? rule.daysAfterPeriodEnd() : null)
            .prepDays(r.getFilingDeadlineOffsetDays())
            .deadlineText(r.getDeadlineText())
            .dueDateSource(r.getDueDateSource());

        if (insts.isEmpty()) {
            return b.upcomingInstances(List.of()).totalInstances(0).overdueCount(0).hasOverdue(false).build();
        }

        ReturnFilingInstance current = null;
        for (ReturnFilingInstance i : insts) {
            boolean submitted = ReturnFilingStatus.SUBMITTED.equals(i.getStatus())
                || ReturnFilingStatus.SUBMITTED_LATE.equals(i.getStatus());
            if (!submitted && i.getDueDate() != null && !i.getDueDate().isBefore(now)) {
                if (current == null || i.getDueDate().isBefore(current.getDueDate())) current = i;
            }
        }
        if (current == null) {
            current = insts.stream()
                .max((a, c) -> {
                    if (a.getDueDate() == null) return -1;
                    if (c.getDueDate() == null) return 1;
                    return a.getDueDate().compareTo(c.getDueDate());
                }).orElse(null);
        }
        if (current == null) return null;
        final ReturnFilingInstance currentInst = current;

        List<ReturnFilingInstance> upcoming = insts.stream()
            .filter(i -> i.getDueDate() != null
                && currentInst.getDueDate() != null
                && i.getDueDate().isAfter(currentInst.getDueDate()))
            .sorted(Comparator.comparing(ReturnFilingInstance::getDueDate))
            .limit(5)
            .toList();

        long overdueCount = insts.stream().filter(i ->
            !ReturnFilingStatus.SUBMITTED.equals(i.getStatus()) &&
            !ReturnFilingStatus.SUBMITTED_LATE.equals(i.getStatus()) &&
            i.getDueDate() != null && i.getDueDate().isBefore(now)).count();

        return b
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
            .build();
    }

    public ReturnStatsDto getStats() {
        List<RegulatoryReturn> allReturns = returns.findByStatus(RegulatoryReturnStatus.ACTIVE);
        Set<Long> allReturnIds = allReturns.stream().map(RegulatoryReturn::getReturnId).collect(Collectors.toSet());
        List<ReturnFilingInstance> allInstances = instances.findByReturnIdIn(allReturnIds);
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

        long dueDateNeeded = allReturns.stream().filter(DueRule::dueDateNeeded).count();

        return ReturnStatsDto.builder()
            .total(allInstances.size())
            .overdue(overdue).inProgress(inProgress).submitted(submitted)
            .dueDateNeeded(dueDateNeeded)
            .frequencies(frequencies).regulators(regulators).actNames(actNames)
            .build();
    }

    @Transactional
    public ReturnInstanceDetailResponse getDetail(Long instanceId) {
        Long returnId = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId)).getReturnId();
        RegulatoryReturn r = returns.findById(returnId)
            .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId));
        return ReturnInstanceDetailResponse.from(inst, r.getReturnName(), regulatorLabel(r), r.getReturnOwnerName());
    }

    public List<RegulatoryReturn> listActive() {
        return returns.findByStatus(RegulatoryReturnStatus.ACTIVE);
    }

    @Transactional
    public void advanceStage(Long instanceId, AdvanceStageRequest req, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId));
        int idx = STAGES.indexOf(inst.getCurrentStage());
        if (idx < 0 || idx >= STAGES.size() - 1)
            throw ApiException.conflict("invalid_transition", "Cannot advance from stage: "
                + (inst.getCurrentStage() != null ? inst.getCurrentStage().db() : "none"));
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
        } catch (Exception e) { throw new IllegalStateException("Failed to serialize stage data", e); }

        inst.setCurrentStage(next);
        inst.setStatus(ReturnFilingStatus.IN_PROGRESS);
        inst.setStageOwnerUserId(userId);
        instances.save(inst);
        audit.log(userId, "return_stage_advanced", "return_instance", instanceId,
            Map.of("from", STAGES.get(idx).db(), "to", next.db()));
    }

    @Transactional
    public void submit(Long instanceId, String evidenceUrl, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId));
        if (inst.getStatus() == ReturnFilingStatus.SUBMITTED || inst.getStatus() == ReturnFilingStatus.SUBMITTED_LATE)
            throw ApiException.conflict("already_submitted", "This return has already been submitted");
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
        } catch (Exception e) { throw new IllegalStateException("Failed to serialize stage data", e); }

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
        try {
            return doCreate(req, userId);
        } catch (RuntimeException e) {
            rollback();
            throw e;
        }
    }

    private RegulatoryReturn doCreate(CreateReturnRequest req, Integer userId) {
        ReturnFrequency freq = resolveFrequency(req.getFrequency());
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
            .returnType(req.getReturnType())
            .frequency(freq != null ? freq.label() : null)
            .frequencyType(freq != null ? freq.name() : ReturnFrequency.MONTHLY.name())
            .filingDate(req.getFilingDate())
            .dueDateSource(req.getFilingDate() != null ? DueRule.SOURCE_USER : null)
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

    /**
     * Sets a return's frequency and due-date rule ({@code PUT /returns/{id}/schedule}). The rule becomes
     * user-owned (source {@code user}), the other rule kind is cleared, untouched periods are deleted and the
     * schedule is regenerated from the rule; touched periods are kept as they are.
     */
    @Transactional
    public ReturnRegisterItem updateSchedule(Long returnId, UpdateScheduleRequest req, Integer userId) {
        try {
            return doUpdateSchedule(returnId, req, userId);
        } catch (RuntimeException e) {
            rollback();
            throw e;
        }
    }

    private ReturnRegisterItem doUpdateSchedule(Long returnId, UpdateScheduleRequest req, Integer userId) {
        RegulatoryReturn r = returns.findById(returnId)
            .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
        if (req == null) throw ApiException.badRequest("bad_request", "Request body is required");

        ReturnFrequency freq;
        if (req.getFrequency() == null || req.getFrequency().isBlank()) {
            freq = DueRule.typeOf(r);
        } else {
            freq = ReturnFrequency.fromLabel(req.getFrequency())
                .or(() -> ReturnFrequency.fromCode(req.getFrequency()))
                .orElseThrow(() -> invalid("Frequency '" + req.getFrequency() + "' must be one of "
                    + String.join(", ", ReturnFrequency.LABELS)));
        }

        String ruleType = req.getRuleType() == null || req.getRuleType().isBlank()
            ? null : req.getRuleType().trim().toUpperCase(Locale.ROOT);
        LocalDate anchor = null;
        Integer offsetDays = null;
        if (ruleType == null) {
            if (DueRule.stepMonths(freq) > 0)
                throw invalid(freq.label() + " returns need a due date rule (a first due date or days after period end)");
        } else if (ruleType.equals(DueRule.Kind.DATE.name())) {
            if (req.getFirstDueDate() == null) throw invalid("firstDueDate is required for a DATE rule");
            anchor = req.getFirstDueDate();
        } else if (ruleType.equals(DueRule.Kind.OFFSET.name())) {
            if (!DueRule.offsetSupported(freq))
                throw invalid("Days after period end is not available for " + freq.label() + " returns");
            Integer d = req.getDaysAfterPeriodEnd();
            if (d == null) throw invalid("daysAfterPeriodEnd is required for an OFFSET rule");
            int max = freq == ReturnFrequency.MONTHLY ? 28 : 365;
            if (d < 1 || d > max)
                throw invalid("daysAfterPeriodEnd must be between 1 and " + max + " for " + freq.label() + " returns");
            offsetDays = d;
        } else {
            throw invalid("ruleType must be DATE, OFFSET or null");
        }
        if (req.getPrepDays() != null && (req.getPrepDays() < 0 || req.getPrepDays() > 365))
            throw invalid("prepDays must be between 0 and 365");

        Map<String, Object> before = new LinkedHashMap<>();
        before.put("frequencyType", r.getFrequencyType());
        before.put("filingDate", r.getFilingDate() != null ? r.getFilingDate().toString() : null);
        before.put("daysAfterPeriodEnd", r.getDueDaysAfterPeriodEnd());

        r.setFrequencyType(freq.name());
        if (req.getFrequency() != null && !req.getFrequency().isBlank()) r.setFrequency(freq.label());
        r.setFilingDate(anchor);
        r.setDueDaysAfterPeriodEnd(offsetDays);
        r.setDueDateSource(DueRule.SOURCE_USER);
        if (req.getPrepDays() != null) r.setFilingDeadlineOffsetDays(req.getPrepDays());
        returns.save(r);

        List<ReturnFilingInstance> removable = untouched.removable(instances.findByReturnId(returnId));
        instances.deleteAll(removable);
        instances.flush();
        if (r.getStatus() == RegulatoryReturnStatus.ACTIVE) ensureInstances(r);
        instances.flush();

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("before", before);
        details.put("frequencyType", freq.name());
        details.put("ruleType", ruleType);
        details.put("filingDate", anchor != null ? anchor.toString() : null);
        details.put("daysAfterPeriodEnd", offsetDays);
        details.put("instancesRemoved", removable.size());
        audit.log(userId, "return_schedule_updated", "return", returnId, details);

        return buildRegisterItem(r, instances.findByReturnId(returnId), LocalDate.now());
    }

    private static ApiException invalid(String message) {
        return ApiException.badRequest("validation_failed", message);
    }

    @Transactional
    public void linkObligations(Long returnId, List<Long> obligationIds, Integer userId) {
        try {
            if (!returns.existsById(returnId))
                throw ApiException.notFound("Return not found: " + returnId);
            obligations.deleteObligationLinks(returnId);
            if (obligationIds != null) {
                for (Long oid : new LinkedHashSet<>(obligationIds)) {
                    if (!obligations.existsById(oid))
                        throw ApiException.badRequest("Obligation not found: " + oid);
                    obligations.insertReturnLink(oid, returnId);
                }
            }
            audit.log(userId, "link_obligations", "return", returnId,
                Collections.singletonMap("obligationIds", obligationIds));
            evictObligationRegisterAfterCommit();
        } catch (RuntimeException e) {
            rollback();
            throw e;
        }
    }

    public List<LinkedObligationItem> linkedObligations(Long returnId) {
        return obligations.findLinkedObligationDetails(returnId).stream()
            .map(r -> LinkedObligationItem.builder()
                .obligationId(r.getObligationId())
                .title(r.getTitle())
                .name(r.getName())
                .plainEnglishStatement(r.getPlainEnglishStatement())
                .sectionReference(r.getSectionReference())
                .areaOfFocus(r.getAreaOfFocus())
                .inherentRiskRating(r.getInherentRiskRating())
                .actName(r.getActName())
                .obligationType(r.getObligationType())
                .recurringDeadlineType(r.getRecurringDeadlineType())
                .build())
            .collect(Collectors.toList());
    }

    private void ensureInstancesForActive() {
        for (RegulatoryReturn r : returns.findByStatus(RegulatoryReturnStatus.ACTIVE)) {
            try { ensureInstances(r); }
            catch (Exception e) { log.warn("ensureInstances failed for return {}: {}", r.getReturnId(), e.getMessage()); }
        }
    }

    /**
     * Idempotently generates filing instances up to the lookahead horizon; existing periods are never
     * duplicated (dedupe on return + period). Event-driven returns get none. A Monthly-or-longer return with
     * no due rule gets none either ("Due date needed"). A return WITH a rule is always generated
     * deterministically from the rule starting today — never continued from its latest instance, which would
     * carry dates over from a previous rule:
     * <ul>
     *   <li>offset rule ({@code due_days_after_period_end}): see {@link #populateOffset};</li>
     *   <li>date rule ({@code filing_date} anchor): see {@link #populateAnchored}.</li>
     * </ul>
     * Only rule-less Daily / Weekly returns continue from their latest instance (else start today).
     * Runs in the caller's transaction (none for the scheduler, so each save commits on its own).
     */
    public void ensureInstances(RegulatoryReturn ret) {
        PeriodStep step = stepForType(ret.getFrequencyType());
        if (step == null) return; // EVENT_DRIVEN — no instances
        DueRule rule = DueRule.of(ret);
        if (step.unit() == PeriodUnit.MONTH && rule == null) return; // due date needed — nothing to generate
        LocalDate today = LocalDate.now();
        LocalDate horizon = today.plusDays(Math.max(lookaheadDays, 1));
        Set<String> existing = instances.findByReturnId(ret.getReturnId()).stream()
            .map(ReturnFilingInstance::getPeriod).filter(Objects::nonNull)
            .collect(Collectors.toCollection(HashSet::new));

        if (rule != null && rule.kind() == DueRule.Kind.OFFSET && step.unit() == PeriodUnit.MONTH) {
            populateOffset(ret, step.amount(), rule.daysAfterPeriodEnd(), today, horizon, existing);
        } else if (rule != null && rule.kind() == DueRule.Kind.DATE) {
            populateAnchored(ret, rule.firstDueDate(), step, today, horizon, existing);
        } else {
            Optional<ReturnFilingInstance> latest = instances.findTopByReturnIdOrderByPeriodDesc(ret.getReturnId());
            LocalDate start = latest.map(l -> advance(l.getDueDate(), step)).orElse(today);
            populate(ret, start, step, today, horizon, 0, existing);
        }
    }

    /**
     * Offset rule: calendar-aligned periods (every month end; quarters ending Mar/Jun/Sep/Dec; half-years
     * Jun/Dec; years Dec), each due its period end + {@code days}. First instance = the earliest period whose
     * due date is today or later, created even beyond the horizon; later ones follow up to the horizon. The
     * period label is the month of the due date, as for every other rule kind.
     */
    private void populateOffset(RegulatoryReturn ret, int stepMonths, int days, LocalDate today,
                                LocalDate horizon, Set<String> existing) {
        // Earliest period end P with P + days >= today, i.e. P >= today - days, aligned up to a cycle boundary.
        YearMonth ym = YearMonth.from(today.minusDays(days));
        while (ym.getMonthValue() % stepMonths != 0) ym = ym.plusMonths(1);
        for (int n = 0; n < 400; n++) {
            LocalDate due = ym.atEndOfMonth().plusDays(days);
            if (n > 0 && due.isAfter(horizon)) break;
            materializeAt(ret, YearMonth.from(due).toString(), due, existing);
            ym = ym.plusMonths(stepMonths);
        }
    }

    /**
     * First instance = the earliest cycle date (anchor + k steps, k >= 0) on or after today, created even
     * when it lies beyond the horizon (an Annual return due next March must still appear in the register).
     * Later instances follow up to the horizon. Every date is computed from the original anchor, so
     * month-end clamping never drifts (31 Jan → 28 Feb → 31 Mar).
     */
    private void populateAnchored(RegulatoryReturn ret, LocalDate anchor, PeriodStep step,
                                  LocalDate today, LocalDate horizon, Set<String> existing) {
        long k = anchoredFirstIndex(anchor, step, today);
        materialize(ret, nthCycleDate(anchor, step, k), step, existing);
        for (long n = k + 1; n <= k + 400; n++) {
            LocalDate d = nthCycleDate(anchor, step, n);
            if (d.isAfter(horizon)) break;
            materialize(ret, d, step, existing);
        }
    }

    /** Smallest k >= 0 with {@code nthCycleDate(anchor, step, k) >= today}. */
    private long anchoredFirstIndex(LocalDate anchor, PeriodStep step, LocalDate today) {
        if (!anchor.isBefore(today)) return 0;
        long stepDays = switch (step.unit()) {
            case DAY -> step.amount();
            case WEEK -> 7L * step.amount();
            case MONTH -> 0;
        };
        if (stepDays > 0) {
            long days = ChronoUnit.DAYS.between(anchor, today);
            return (days + stepDays - 1) / stepDays; // round up
        }
        long k = Math.max(1, ChronoUnit.MONTHS.between(anchor, today) / step.amount());
        while (nthCycleDate(anchor, step, k).isBefore(today)) k++;
        return k;
    }

    /** anchor + n steps; months are added from the anchor in one go (plusMonths clamps to month length). */
    private LocalDate nthCycleDate(LocalDate anchor, PeriodStep step, long n) {
        return switch (step.unit()) {
            case DAY   -> anchor.plusDays(n * step.amount());
            case WEEK  -> anchor.plusWeeks(n * step.amount());
            case MONTH -> anchor.plusMonths(n * step.amount());
        };
    }

    private void populate(RegulatoryReturn ret, LocalDate cursor, PeriodStep step,
                          LocalDate earliest, LocalDate horizon, int depth, Set<String> existing) {
        if (depth > 365 || cursor.isAfter(horizon)) return;
        if (!cursor.isBefore(earliest)) {
            materialize(ret, cursor, step, existing);
        }
        populate(ret, advance(cursor, step), step, earliest, horizon, depth + 1, existing);
    }

    private void materialize(RegulatoryReturn ret, LocalDate cursor, PeriodStep step, Set<String> existing) {
        String period;
        LocalDate due;

        if (step.unit() == PeriodUnit.DAY) {
            period = cursor.toString(); // "2026-09-25"
            due = cursor;
        } else if (step.unit() == PeriodUnit.WEEK) {
            int week = cursor.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
            int weekYear = cursor.get(IsoFields.WEEK_BASED_YEAR);
            period = weekYear + "-W" + String.format("%02d", week); // "2026-W38"
            due = cursor;
        } else {
            // Monthly / Quarterly / Semi-Annual / Annual / Biennial: only reached with a date anchor.
            period = YearMonth.from(cursor).toString(); // "2026-09"
            int day = ret.getFilingDate() != null
                ? Math.min(ret.getFilingDate().getDayOfMonth(), cursor.lengthOfMonth())
                : cursor.getDayOfMonth();
            due = cursor.withDayOfMonth(day);
        }
        materializeAt(ret, period, due, existing);
    }

    private void materializeAt(RegulatoryReturn ret, String period, LocalDate due, Set<String> existing) {
        if (!existing.add(period)) return;
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

    /** Blank → null; otherwise a canonical label/alias or recognisable free text, else 400. */
    private static ReturnFrequency resolveFrequency(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return ReturnFrequency.fromLabel(raw).or(() -> ReturnFrequency.classify(raw))
            .orElseThrow(() -> ApiException.badRequest("invalid_frequency",
                "Frequency '" + raw + "' must be one of " + String.join(", ", ReturnFrequency.LABELS)));
    }

    /**
     * Frequency filter. A known frequency ("Annual", "Event-driven") matches on the return's stored
     * {@code frequencyType} (the type that drives its instances; legacy mis-typed rows are fixed by the
     * frequency repair), falling back to classifying its text only when no valid type is stored. So
     * "Semi-Annual" never matches "Annual". Any other filter is a text contains-match.
     */
    private static boolean matchesFrequency(RegulatoryReturn r, String filter) {
        Optional<ReturnFrequency> f = ReturnFrequency.fromLabel(filter);
        if (f.isPresent()) {
            Optional<ReturnFrequency> effective = ReturnFrequency.fromCode(r.getFrequencyType())
                .or(() -> ReturnFrequency.classify(r.getFrequency()));
            return effective.isPresent() && effective.get() == f.get();
        }
        return r.getFrequency() != null && r.getFrequency().toLowerCase().contains(filter.toLowerCase());
    }

    /** The register reads return links through a short-lived cache; drop it once the change is visible. */
    private void evictObligationRegisterAfterCommit() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { obligationService.evictRegisterCache(); }
            });
        } else {
            obligationService.evictRegisterCache();
        }
    }

    private void rollback() {
        try {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        } catch (Throwable ignored) {
            // no active transaction
        }
        em.clear();
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