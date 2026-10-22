package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.atheris.compliance.tenant.backend.modules.acts.entity.Act;
import com.atheris.compliance.tenant.backend.modules.acts.repository.ActRepository;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationLevelRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyDto;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.returns.dto.*;
import com.atheris.compliance.tenant.backend.modules.returns.entity.*;
import com.atheris.compliance.tenant.backend.modules.returns.repository.*;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
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
    private static final List<ReturnStage> STAGES = List.of(ReturnStage.values());
    /** Register status filter value for returns with no due rule. */
    public static final String STATUS_DUE_DATE_NEEDED = "Due date needed";

    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final ReturnUploadLinkRepository uploadLinks;
    private final TenantRegulatorRepository regulators;
    private final ActRepository acts;
    private final ObligationRepository obligations;
    private final AuditService audit;
    private final TenantIdentityService tenantIdentity;
    private final ObligationService obligationService;
    private final UntouchedInstances untouched;
    private final EscalationPolicyService escalationPolicyService;
    private final NotificationService notifications;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @PersistenceContext
    private EntityManager em;

    @Value("${atheris.returns.instance-lookahead-days:120}")
    private int lookaheadDays;

    @Scheduled(fixedDelay = 300000)
    void scheduledMaintenance() {
        try { ensureInstancesForActive(); } catch (Exception e) { log.warn("Scheduled ensureInstances failed: {}", e.getMessage()); }
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
            String requestedStatus = status.trim();
            List<ReturnFilingInstance> filtered = allInstances.stream().filter(i -> {
                RegulatoryReturn parent = returnMap.get(i.getReturnId());
                boolean eventDriven = parent != null && ReturnFrequency.fromCode(parent.getFrequencyType())
                    .orElse(ReturnFrequency.MONTHLY) == ReturnFrequency.EVENT_DRIVEN;
                boolean overdue = i.getDueDate() != null && i.getDueDate().isBefore(LocalDate.now())
                    && !isSubmitted(i.getStatus() != null ? i.getStatus().db() : null);
                if ("Overdue".equalsIgnoreCase(requestedStatus)) return overdue && (!eventDriven || i.getTriggerDate() != null);
                if (eventDriven && i.getTriggerDate() == null) return false;
                return i.getStatus() != null && i.getStatus().db().equalsIgnoreCase(requestedStatus);
            }).toList();
            allInstances = filtered;
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
                                                 String act, String frequencyType, String responsibleUnit,
                                                 Long actId, String status, Boolean unlinked, Pageable p) {

        List<RegulatoryReturn> allReturns = returns.findByStatus(RegulatoryReturnStatus.ACTIVE);

        // Apply filters
        if (act != null && !act.isBlank()) {
            String al = act.toLowerCase();
            allReturns = allReturns.stream().filter(r ->
                r.getActName() != null && r.getActName().toLowerCase().contains(al)).toList();
        }
        if (actId != null) {
            allReturns = allReturns.stream().filter(r -> actId.equals(r.getActId())).toList();
        }
        if (frequencyType != null && !frequencyType.isBlank()) {
            allReturns = allReturns.stream().filter(r ->
                frequencyType.equalsIgnoreCase(r.getFrequencyType())).toList();
        }
        if (responsibleUnit != null && !responsibleUnit.isBlank()) {
            allReturns = allReturns.stream().filter(r ->
                responsibleUnit.equalsIgnoreCase(r.getResponsibleUnit())).toList();
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
        // One query for every return's obligation-link count (data-quality signal for the row).
        Map<Long, Long> linkCountByReturn = obligations.findAllReturnLinks().stream()
            .collect(Collectors.groupingBy(ObligationRepository.ObligationReturnRow::getReturnId, Collectors.counting()));

        List<ReturnRegisterItem> items = new ArrayList<>();
        boolean filterStatus = status != null && !status.isBlank();
        boolean dueDateNeededFilter = filterStatus && STATUS_DUE_DATE_NEEDED.equalsIgnoreCase(status.trim());

        for (RegulatoryReturn r : allReturns) {
            List<ReturnFilingInstance> insts = instsByReturn.getOrDefault(r.getReturnId(), List.of());
            ReturnRegisterItem item = buildRegisterItem(r, insts, now,
                linkCountByReturn.getOrDefault(r.getReturnId(), 0L));
            if (item == null) continue;
            if (unlinked != null) {
                boolean hasLinks = item.getLinkedObligationCount() != null && item.getLinkedObligationCount() > 0;
                if (unlinked == hasLinks) continue; // unlinked=true keeps link-less rows; false keeps linked ones
            }
            boolean eventDriven = ReturnFrequency.fromCode(r.getFrequencyType()).orElse(ReturnFrequency.MONTHLY)
                == ReturnFrequency.EVENT_DRIVEN;
            if (dueDateNeededFilter) {
                if (!item.isDueDateNeeded()) continue;
            } else if (filterStatus) {
                // Event-driven / not materialised / due date needed rows have no status: any status filter excludes them.
                boolean hasAnyFiling = insts.stream().anyMatch(i -> !eventDriven || i.getTriggerDate() != null);
                if (!hasAnyFiling) continue;
                if (eventDriven) {
                    boolean hasEventWithStatus = insts.stream().anyMatch(i -> i.getTriggerDate() != null
                        && i.getStatus() != null && i.getStatus().db().equalsIgnoreCase(status));
                    boolean hasEventOverdue = "Overdue".equalsIgnoreCase(status) && insts.stream().anyMatch(i -> i.getTriggerDate() != null
                        && i.getDueDate() != null && i.getDueDate().isBefore(now)
                        && !isSubmitted(i.getStatus() != null ? i.getStatus().db() : null));
                    if (!hasEventWithStatus && !hasEventOverdue) continue;
                } else if (item.getCurrentInstanceId() == null) continue;
                if (!eventDriven) {
                    String matchStatus = item.getCurrentDueDate() != null && item.getCurrentDueDate().isBefore(now)
                        && !isSubmitted(item.getCurrentStatus()) ? "Overdue"
                        : (item.getCurrentStatus() != null ? item.getCurrentStatus() : "");
                    if (!matchStatus.equalsIgnoreCase(status)) continue;
                }
            }
            items.add(item);
        }

        // Sort — honour the requested Pageable sort for whitelisted fields, else default to due date (earliest first).
        Comparator<ReturnRegisterItem> cmp = registerComparator(p.getSort());
        items.sort(cmp);

        // Paginate in-memory
        int total = items.size();
        int start = (int) p.getOffset();
        int end = Math.min(start + p.getPageSize(), total);
        List<ReturnRegisterItem> page = start > total ? List.of() : items.subList(start, end);

        return new PageImpl<>(page, p, total);
    }

    @Transactional(readOnly = true)
    public ReturnRegisterItem getRegisterItem(Long returnId) {
        RegulatoryReturn ret = returns.findById(returnId)
            .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
        return buildRegisterItem(ret, instances.findByReturnId(returnId), LocalDate.now());
    }

    @Transactional
    public ReturnRegisterItem updateEscalationPolicy(Long returnId, Long policyId, Integer userId) {
        RegulatoryReturn ret = returns.findById(returnId)
            .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
        if (policyId != null) {
            EscalationPolicyDto policy = escalationPolicyService.get(policyId);
            if (!EscalationConstants.SUBJECT_RETURN.equalsIgnoreCase(policy.getSubjectType()))
                throw ApiException.badRequest("invalid_policy", "Select a return escalation policy");
        }
        ret.setEscalationPolicyId(policyId);
        returns.save(ret);
        audit.log(userId, "return_escalation_policy_set", "return", returnId,
            Collections.singletonMap("policyId", String.valueOf(policyId)));
        return buildRegisterItem(ret, instances.findByReturnId(returnId), LocalDate.now());
    }

    @Transactional
    public ReturnRegisterItem updateBasic(Long returnId, UpdateReturnRequest req, Integer userId) {
        try {
            RegulatoryReturn r = returns.findById(returnId)
                .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
            List<String> persons = req.getResponsiblePersons() == null ? List.<String>of()
                : req.getResponsiblePersons().stream().filter(p -> p != null && !p.isBlank()).map(String::trim).toList();
            if (persons.isEmpty())
                throw ApiException.badRequest("responsible_person_required", "Select at least one responsible person.");
            r.setResponsiblePersons(persons);
            r.setResponsiblePerson(persons.get(0));
            if (req.getReturnOwnerUserId() != null) {
                r.setReturnOwnerUserId(req.getReturnOwnerUserId());
                r.setReturnOwnerName(req.getReturnOwnerName());
            }
            returns.save(r);
            audit.log(userId, "return_updated", "return", returnId,
                Collections.singletonMap("responsiblePersons", String.valueOf(persons.size())));
            ensureInstances(r);
            return buildRegisterItem(r, instances.findByReturnId(returnId), LocalDate.now());
        } catch (Throwable e) {
            rollback();
            throw e instanceof RuntimeException re ? re : new RuntimeException(e);
        }
    }

    @Transactional
    public ReturnRegisterItem updateEscalation(Long returnId, UpdateReturnEscalationRequest req, Integer userId) {
        try {
            RegulatoryReturn r = returns.findById(returnId)
                .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
            List<EscalationLevelRequest> levels = List.of(
                EscalationLevelRequest.builder().levelNo(1).afterValue(0).afterUnit(EscalationConstants.UNIT_DAYS)
                    .targetType(EscalationConstants.TARGET_PERSON).targetUserId(req.getEscalateToUserId())
                    .targetName(req.getEscalateToName()).targetEmail(req.getEscalateToEmail()).build(),
                EscalationLevelRequest.builder().levelNo(2).afterValue(3).afterUnit(EscalationConstants.UNIT_DAYS)
                    .targetType(EscalationConstants.TARGET_MANAGER).build(),
                EscalationLevelRequest.builder().levelNo(3).afterValue(7).afterUnit(EscalationConstants.UNIT_DAYS)
                    .targetType(EscalationConstants.TARGET_MANAGER_OF_MANAGER).targetRole(AppRole.CCO).build());
            EscalationPolicyRequest policyReq = EscalationPolicyRequest.builder()
                .name(r.getReturnName() + " escalation #" + r.getReturnId())
                .subjectType(EscalationConstants.SUBJECT_RETURN)
                .frequencyScope(r.getFrequencyType())
                .isDefault(false).isActive(true)
                .reminderStartValue(req.getReminderStartValue())
                .reminderStartUnit(req.getReminderStartUnit())
                .reminderRepeatValue(req.getReminderRepeatValue())
                .reminderRepeatUnit(req.getReminderRepeatUnit())
                .sendLink(true).levels(levels).build();
            Long policyId = r.getEscalationPolicyId();
            EscalationPolicyDto dto = policyId == null
                ? escalationPolicyService.create(policyReq, userId)
                : escalationPolicyService.update(policyId, policyReq, userId);
            r.setEscalationPolicyId(dto.getPolicyId());
            returns.save(r);
            audit.log(userId, "return_escalation_set", "return", returnId,
                Collections.singletonMap("policyId", String.valueOf(dto.getPolicyId())));
            return buildRegisterItem(r, instances.findByReturnId(returnId), LocalDate.now());
        } catch (Throwable e) {
            rollback();
            throw e instanceof RuntimeException re ? re : new RuntimeException(e);
        }
    }

    /**
     * In-memory sort for the register (the rows are assembled from several queries). Only whitelisted
     * properties are honoured — anything else (incl. service-resolved fields) falls back to the default
     * of current due date ascending, so a bad {@code sort=} can never throw.
     */
    static Comparator<ReturnRegisterItem> registerComparator(Sort sort) {
        Comparator<ReturnRegisterItem> cmp = null;
        if (sort != null && sort.isSorted()) {
            for (Sort.Order order : sort) {
                Comparator<ReturnRegisterItem> c = registerFieldComparator(order.getProperty());
                if (c == null) continue;
                if (order.isDescending()) c = c.reversed();
                cmp = cmp == null ? c : cmp.thenComparing(c);
            }
        }
        if (cmp == null) {
            cmp = Comparator.comparing(ReturnRegisterItem::getCurrentDueDate,
                Comparator.nullsLast(Comparator.naturalOrder()));
        }
        return cmp;
    }

    private static Comparator<ReturnRegisterItem> registerFieldComparator(String property) {
        return switch (property == null ? "" : property) {
            case "returnName" -> Comparator.comparing(ReturnRegisterItem::getReturnName,
                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "filingRegulator", "regulator" -> Comparator.comparing(ReturnRegisterItem::getFilingRegulator,
                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "currentDueDate", "dueDate" -> Comparator.comparing(ReturnRegisterItem::getCurrentDueDate,
                Comparator.nullsLast(Comparator.naturalOrder()));
            case "currentStatus", "status" -> Comparator.comparing(ReturnRegisterItem::getCurrentStatus,
                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            default -> null;
        };
    }

    private static boolean isSubmitted(String status) {
        return ReturnFilingStatus.SUBMITTED.db().equalsIgnoreCase(status)
            || ReturnFilingStatus.SUBMITTED_LATE.db().equalsIgnoreCase(status);
    }

    private static boolean isReturnOverdue(ReturnRegisterItem item, LocalDate now) {
        boolean eventDriven = item.getFrequencyType() != null
            && ReturnFrequency.EVENT_DRIVEN.name().equalsIgnoreCase(item.getFrequencyType());
        if (eventDriven) return item.getEventOverdueCount() > 0;
        return item.getCurrentDueDate() != null && item.getCurrentDueDate().isBefore(now)
            && !isSubmitted(item.getCurrentStatus());
    }

    /** Display deadline for the shared register column: the regulator's wording, else the current due date. */
    private static String deadlineOf(RegulatoryReturn r, LocalDate currentDue) {
        String text = r.getDeadlineText();
        if (text != null && !text.isBlank()) return text;
        return currentDue != null ? currentDue.toString() : null;
    }

    /**
     * One register row: the return's schedule fields plus its current instance (closest non-submitted one
     * due today or later, else the latest) and the next five. A return without instances (event-driven, not
     * materialised yet, or due date needed) is listed without a current period/status.
     */
    private ReturnRegisterItem buildRegisterItem(RegulatoryReturn r, List<ReturnFilingInstance> insts, LocalDate now) {
        return buildRegisterItem(r, insts, now, linkedObligationCount(r.getReturnId()));
    }

    private ReturnRegisterItem buildRegisterItem(RegulatoryReturn r, List<ReturnFilingInstance> insts, LocalDate now,
                                                 long linkedObligationCount) {
        DueRule rule = DueRule.of(r);
        ReturnRegisterItem.ReturnRegisterItemBuilder b = ReturnRegisterItem.builder()
            .returnId(r.getReturnId())
            .returnName(r.getReturnName())
            .title(r.getReturnName())
            .deadline(r.getDeadlineText())
            .actId(r.getActId())
            .actName(r.getActName())
            .linkedObligationCount((int) linkedObligationCount)
            .linkedObligationTitle(obligationFallbackTitle(r))
            .filingRegulator(r.getFilingRegulator())
            .frequency(r.getFrequency())
            .frequencyType(r.getFrequencyType())
            .responsibleUnit(r.getResponsibleUnit())
            .responsiblePerson(r.getResponsiblePerson())
            .responsibleUnits(r.getResponsibleUnits())
            .responsiblePersons(r.getResponsiblePersons())
            .escalationPolicyId(r.getEscalationPolicyId())
            .dueDateNeeded(DueRule.dueDateNeeded(r))
            .dueRuleType(rule != null ? rule.kind().name() : null)
            .firstDueDate(rule != null && rule.kind() == DueRule.Kind.DATE ? rule.firstDueDate() : null)
            .daysAfterPeriodEnd(rule != null && rule.kind() == DueRule.Kind.OFFSET ? rule.daysAfterPeriodEnd() : null)
            .prepDays(r.getFilingDeadlineOffsetDays())
            .deadlineText(r.getDeadlineText())
            .dueDateSource(r.getDueDateSource())
            .eventTriggerConfigured(r.getEventTriggerLabel() != null && !r.getEventTriggerLabel().isBlank()
                && r.getEventDeadlineMode() != null)
            .eventTriggerLabel(r.getEventTriggerLabel())
            .eventDeadlineMode(r.getEventDeadlineMode())
            .eventDeadlineDays(r.getEventDeadlineDays())
            .eventDeadlineUnit(r.getEventDeadlineUnit())
            .eventFilingCount((int) insts.stream().filter(i -> i.getTriggerDate() != null).count())
            .eventOverdueCount(insts.stream().filter(i -> i.getTriggerDate() != null
                && i.getDueDate() != null && i.getDueDate().isBefore(now)
                && !isSubmitted(i.getStatus() != null ? i.getStatus().db() : null)).count());

        if (insts.isEmpty()) {
            return b.upcomingInstances(List.of()).totalInstances(0).overdueCount(0).hasOverdue(false).build();
        }

        boolean eventDriven = ReturnFrequency.fromCode(r.getFrequencyType()).orElse(ReturnFrequency.MONTHLY)
            == ReturnFrequency.EVENT_DRIVEN;
        if (eventDriven) {
            ReturnFilingInstance currentEvent = insts.stream().filter(i -> i.getTriggerDate() != null)
                .filter(i -> !isSubmitted(i.getStatus() != null ? i.getStatus().db() : null))
                .min(Comparator.comparing(ReturnFilingInstance::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElseGet(() -> insts.stream().filter(i -> i.getTriggerDate() != null)
                    .max(Comparator.comparing(ReturnFilingInstance::getTriggerDate)).orElse(null));
            long eventOverdue = insts.stream().filter(i -> i.getTriggerDate() != null
                && !isSubmitted(i.getStatus() != null ? i.getStatus().db() : null)
                && i.getDueDate() != null && i.getDueDate().isBefore(now)).count();
            if (currentEvent == null) return b.upcomingInstances(List.of()).totalInstances(insts.size())
                .overdueCount((int) eventOverdue).hasOverdue(eventOverdue > 0).build();
            return b.currentPeriod(currentEvent.getTriggerDate().toString()).currentDueDate(currentEvent.getDueDate())
                .deadline(deadlineOf(r, currentEvent.getDueDate()))
                .currentStatus(currentEvent.getStatus() != null ? currentEvent.getStatus().db() : null)
                .currentStage(currentEvent.getCurrentStage() != null ? currentEvent.getCurrentStage().db() : null)
                .currentInstanceId(currentEvent.getInstanceId()).upcomingInstances(List.of())
                .totalInstances(insts.size()).overdueCount((int) eventOverdue).hasOverdue(eventOverdue > 0).build();
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
            .deadline(deadlineOf(r, current.getDueDate()))
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

    static final int DUE_SOON_DAYS = 30;

    /**
     * Every tracked filing period in exactly one bucket. Event-driven periods count only once
     * triggered (until then nothing is due).
     */
    static ReturnStatsDto.StatusBuckets statusBuckets(List<ReturnFilingInstance> instances,
                                                      Set<Long> eventReturnIds, LocalDate today) {
        long onTime = 0, late = 0, overdue = 0, inProgress = 0, notYetDue = 0, dueSoon = 0;
        for (ReturnFilingInstance i : instances) {
            if (eventReturnIds.contains(i.getReturnId()) && i.getTriggerDate() == null) continue;
            ReturnFilingStatus st = i.getStatus();
            if (st == ReturnFilingStatus.SUBMITTED) { onTime++; continue; }
            if (st == ReturnFilingStatus.SUBMITTED_LATE) { late++; continue; }
            LocalDate due = i.getDueDate();
            if (due != null && due.isBefore(today)) { overdue++; continue; }
            if (st == ReturnFilingStatus.IN_PROGRESS) inProgress++; else notYetDue++;
            if (due != null && !due.isAfter(today.plusDays(DUE_SOON_DAYS))) dueSoon++;
        }
        return ReturnStatsDto.StatusBuckets.builder()
            .tracked(onTime + late + overdue + inProgress + notYetDue)
            .filedOnTime(onTime).filedLate(late).overdue(overdue)
            .inProgressNotDue(inProgress).notYetDue(notYetDue).dueSoon(dueSoon)
            .build();
    }

    public ReturnStatsDto getStats() {
        List<RegulatoryReturn> allReturns = returns.findByStatus(RegulatoryReturnStatus.ACTIVE);
        Set<Long> allReturnIds = allReturns.stream().map(RegulatoryReturn::getReturnId).collect(Collectors.toSet());
        List<ReturnFilingInstance> allInstances = instances.findByReturnIdIn(allReturnIds);
        LocalDate now = LocalDate.now();
        Set<Long> eventReturnIds = allReturns.stream()
            .filter(r -> ReturnFrequency.fromCode(r.getFrequencyType()).orElse(ReturnFrequency.MONTHLY) == ReturnFrequency.EVENT_DRIVEN)
            .map(RegulatoryReturn::getReturnId).collect(Collectors.toSet());
        Map<Long, List<ReturnFilingInstance>> instsByReturn = allInstances.stream()
            .collect(Collectors.groupingBy(ReturnFilingInstance::getReturnId));
        List<ReturnRegisterItem> rowItems = allReturns.stream()
            .map(r -> buildRegisterItem(r, instsByReturn.getOrDefault(r.getReturnId(), List.of()), now))
            .filter(Objects::nonNull).toList();
        long overdue = rowItems.stream().filter(i -> isReturnOverdue(i, now)).count();
        long inProgress = rowItems.stream().filter(i -> "In Progress".equalsIgnoreCase(i.getCurrentStatus())).count();
        long submitted = rowItems.stream().filter(i -> isSubmitted(i.getCurrentStatus())).count();

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

        long dueDateNeeded = allReturns.stream()
            .filter(r -> ReturnFrequency.fromCode(r.getFrequencyType()).orElse(ReturnFrequency.MONTHLY) != ReturnFrequency.EVENT_DRIVEN)
            .filter(DueRule::dueDateNeeded).count();

        Map<String, Long> byFrequencyType = allReturns.stream()
            .map(RegulatoryReturn::getFrequencyType).filter(v -> v != null && !v.isBlank())
            .collect(Collectors.groupingBy(v -> v, TreeMap::new, Collectors.counting()));
        Map<String, Long> byResponsibleUnit = allReturns.stream()
            .map(RegulatoryReturn::getResponsibleUnit).filter(v -> v != null && !v.isBlank())
            .collect(Collectors.groupingBy(v -> v, TreeMap::new, Collectors.counting()));
        long unassigned = allReturns.stream()
            .filter(r -> r.getResponsibleUnit() == null || r.getResponsibleUnit().isBlank()).count();
        Set<Long> linkedReturnIds = obligations.findAllReturnLinks().stream()
            .map(ObligationRepository.ObligationReturnRow::getReturnId).collect(Collectors.toSet());
        long unlinked = allReturns.stream().map(RegulatoryReturn::getReturnId)
            .filter(id -> !linkedReturnIds.contains(id)).count();
        long missingAct = allReturns.stream()
            .filter(r -> r.getActId() == null && (r.getActName() == null || r.getActName().isBlank())).count();
        List<ReturnStatsDto.ActOption> actOptions = allReturns.stream()
            .filter(r -> r.getActId() != null)
            .collect(Collectors.toMap(RegulatoryReturn::getActId,
                r -> new ReturnStatsDto.ActOption(r.getActId(), r.getActName()),
                (a, b) -> a, TreeMap::new))
            .values().stream().toList();

        return ReturnStatsDto.builder()
            .buckets(statusBuckets(allInstances, eventReturnIds, now))
            .total(rowItems.size())
            .overdue(overdue).inProgress(inProgress).submitted(submitted)
            .dueDateNeeded(dueDateNeeded)
            .frequencies(frequencies).regulators(regulators).actNames(actNames)
            .totalReturns(allReturns.size())
            .frequencyTypeCount(byFrequencyType.size())
            .responsibleUnitCount(byResponsibleUnit.size())
            .unassignedCount(unassigned)
            .unlinkedCount(unlinked)
            .missingActCount(missingAct)
            .byFrequencyType(byFrequencyType)
            .byResponsibleUnit(byResponsibleUnit)
            .frequencyTypes(new ArrayList<>(byFrequencyType.keySet()))
            .responsibleUnits(new ArrayList<>(byResponsibleUnit.keySet()))
            .acts(actOptions)
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
        ReturnInstanceDetailResponse detail = ReturnInstanceDetailResponse.from(inst, r.getReturnName(), regulatorLabel(r), r.getReturnOwnerName());
        detail.setActId(r.getActId());
        detail.setActName(r.getActName());
        detail.setFrequency(r.getFrequency());
        detail.setFrequencyType(r.getFrequencyType());
        detail.setDeadlineText(r.getDeadlineText());
        detail.setEventTriggerLabel(r.getEventTriggerLabel());
        detail.setEventDeadlineMode(r.getEventDeadlineMode());
        detail.setEventDeadlineDays(r.getEventDeadlineDays());
        detail.setEventDeadlineUnit(r.getEventDeadlineUnit());
        return detail;
    }

    public List<RegulatoryReturn> listActive() {
        return returns.findByStatus(RegulatoryReturnStatus.ACTIVE);
    }

    @Transactional
    public void advanceStage(Long instanceId, AdvanceStageRequest req, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId));
        if (inst.getDueDate() == null) throw ApiException.conflict("due_date_missing", "This filing instance has no due date.");
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
        // When a filing reaches Sign-off it is ready for the CCO to submit.
        if (next == ReturnStage.SIGN_OFF) {
            try {
                notifications.notifyRoleEmailed(AppRole.CCO, NotificationConstants.CATEGORY_RETURNS, NotificationConstants.SEVERITY_MEDIUM,
                    "Return filing " + inst.getPeriod() + " is ready for sign-off and submission",
                    "/returns", "Return ready to submit");
            } catch (Exception e) {
                log.warn("Sign-off notification failed for instance {}: {}", instanceId, e.getMessage());
            }
        }
    }

    @Transactional
    public void submit(Long instanceId, String evidenceUrl, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId));
        if (inst.getDueDate() == null) throw ApiException.conflict("due_date_missing", "This filing instance has no due date.");
        if (inst.getStatus() == ReturnFilingStatus.SUBMITTED || inst.getStatus() == ReturnFilingStatus.SUBMITTED_LATE)
            throw ApiException.conflict("already_submitted", "This return has already been submitted");
        // The CCO submits only once the analyst has taken the filing through to Sign-off.
        if (inst.getCurrentStage() != ReturnStage.SIGN_OFF)
            throw ApiException.conflict("not_ready_to_submit",
                "A return can only be submitted once it reaches the Sign-off stage");
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
    public void submitFromLink(Long instanceId, String evidenceRef, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId));
        if (inst.getStatus() == ReturnFilingStatus.SUBMITTED || inst.getStatus() == ReturnFilingStatus.SUBMITTED_LATE)
            return;
        LocalDate today = LocalDate.now();
        boolean late = inst.getDueDate() != null && today.isAfter(inst.getDueDate());
        int daysLate = late ? (int) ChronoUnit.DAYS.between(inst.getDueDate(), today) : 0;
        inst.setCurrentStage(ReturnStage.SUBMITTED);
        inst.setStatus(late ? ReturnFilingStatus.SUBMITTED_LATE : ReturnFilingStatus.SUBMITTED);
        inst.setSubmittedDate(today);
        inst.setSubmittedByUserId(userId);
        inst.setSubmissionEvidenceUrl(evidenceRef);
        inst.setDaysLate(daysLate);
        inst.setEscalationLevel(0);
        inst.setEscalatedAt(null);
        instances.save(inst);
        audit.log(userId, "return_submitted_via_link", "return_instance", instanceId,
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

        // A return must be grounded to a governing act: resolve it and snapshot its name.
        Act act = resolveAct(req.getActId());

        // Due rule — DATE (filingDate anchor) or OFFSET (days after period end). Daily/Weekly/Event-driven need none.
        String ruleType = req.getRuleType() == null || req.getRuleType().isBlank()
            ? null : req.getRuleType().trim().toUpperCase(Locale.ROOT);
        if (ruleType == null && req.getFilingDate() != null) ruleType = DueRule.Kind.DATE.name();
        LocalDate anchor = null;
        Integer offsetDays = null;
        if (ruleType != null) {
            if (ruleType.equals(DueRule.Kind.DATE.name())) {
                if (req.getFilingDate() == null) throw invalid("filingDate is required for a DATE rule");
                anchor = req.getFilingDate();
            } else if (ruleType.equals(DueRule.Kind.OFFSET.name())) {
                if (freq != null && !DueRule.offsetSupported(freq))
                    throw invalid("Days after period end is not available for " + freq.label() + " returns");
                Integer d = req.getDueDaysAfterPeriodEnd();
                if (d == null) throw invalid("dueDaysAfterPeriodEnd is required for an OFFSET rule");
                int max = freq == ReturnFrequency.MONTHLY ? 28 : 365;
                if (d < 1 || d > max)
                    throw invalid("dueDaysAfterPeriodEnd must be between 1 and " + max + " days");
                offsetDays = d;
            } else {
                throw invalid("ruleType must be DATE, OFFSET or null");
            }
        }

        List<String> units = req.getResponsibleUnits() != null ? req.getResponsibleUnits()
            : (req.getResponsibleUnit() != null && !req.getResponsibleUnit().isBlank() ? List.of(req.getResponsibleUnit()) : List.of());
        List<String> persons = req.getResponsiblePersons() != null ? req.getResponsiblePersons()
            : (req.getResponsiblePerson() != null && !req.getResponsiblePerson().isBlank() ? List.of(req.getResponsiblePerson()) : List.of());
        if (persons.isEmpty()) throw ApiException.badRequest("responsible_person_required",
            "Select at least one responsible person — they receive the filing request and submit the data.");
        RegulatoryReturn r = RegulatoryReturn.builder()
            .returnName(req.getReturnName()).filingRegulator(snapshot)
            .tenantRegulatorId(reg != null ? reg.getId() : req.getTenantRegulatorId())
            .actId(act.getRegulationId())
            .actName(act.getName())
            .returnType(req.getReturnType())
            .frequency(freq != null ? freq.label() : null)
            .frequencyType(freq != null ? freq.name() : ReturnFrequency.MONTHLY.name())
            .filingDate(anchor)
            .dueDaysAfterPeriodEnd(offsetDays)
            .dueDateSource(ruleType != null ? DueRule.SOURCE_USER : null)
            .filingDeadlineOffsetDays(req.getFilingDeadlineOffsetDays())
            .filingChannel(req.getFilingChannel())
            .returnOwnerUserId(req.getReturnOwnerUserId())
            .returnOwnerName(req.getReturnOwnerName())
            .responsibleUnits(units)
            .responsiblePersons(persons)
            .responsibleUnit(units.isEmpty() ? null : units.get(0))
            .responsiblePerson(persons.isEmpty() ? null : persons.get(0))
            .escalationPolicyId(req.getEscalationPolicyId()).build();
        RegulatoryReturn saved = returns.save(r);
        ensureInstances(saved);
        audit.log(userId, "return_created", "return", saved.getReturnId(),
            Collections.singletonMap("name", saved.getReturnName()));
        return saved;
    }

    /** Resolves the governing act by its platform regulation id (what a return stores in {@code act_id}). */
    private Act resolveAct(Long actId) {
        if (actId == null) throw ApiException.badRequest("invalid_act", "An act is required for a return");
        return acts.findByRegulationId(actId)
            .orElseThrow(() -> ApiException.badRequest("invalid_act", "Unknown act (regulation id " + actId + ")"));
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
            RegulatoryReturn ret = returns.findById(returnId)
                .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
            obligations.deleteObligationLinks(returnId);
            if (obligationIds != null) {
                for (Long oid : new LinkedHashSet<>(obligationIds)) {
                    if (!obligations.existsById(oid))
                        throw ApiException.badRequest("Obligation not found: " + oid);
                    obligations.insertReturnLink(oid, returnId);
                }
            }
            // Safety net: derive a missing governing act from a linked obligation (new returns require one).
            if (ret.getActId() == null && obligationIds != null && !obligationIds.isEmpty()) {
                obligations.findById(obligationIds.get(0)).ifPresent(ob -> {
                    if (ob.getRegulationId() != null) {
                        ret.setActId(ob.getRegulationId());
                        if (ob.getActName() != null) ret.setActName(ob.getActName());
                        returns.save(ret);
                    }
                });
            }
            audit.log(userId, "link_obligations", "return", returnId,
                Collections.singletonMap("obligationIds", obligationIds));
            evictObligationRegisterAfterCommit();
        } catch (RuntimeException e) {
            rollback();
            throw e;
        }
    }

    /** How many obligations a return is linked to (0 = none) — the register's data-quality signal. */
    private long linkedObligationCount(Long returnId) {
        return obligations.findLinkedObligationIds(returnId).size();
    }

    /**
     * The Act/Obligation column falls back to a linked obligation when a return has no act. Only queried
     * for the (now rare) no-act rows, so the register stays one query for the common case.
     */
    private String obligationFallbackTitle(RegulatoryReturn r) {
        if (r.getActName() != null && !r.getActName().isBlank()) return null;
        return obligations.findLinkedObligationDetails(r.getReturnId()).stream()
            .map(ObligationRepository.LinkedObligationRow::getTitle)
            .filter(t -> t != null && !t.isBlank())
            .findFirst().orElse(null);
    }

    /** Hard-deletes a return and its periods, links and upload links. Blocked once any period has work on it. */
    @Transactional
    public void delete(Long returnId, Integer userId) {
        try {
            RegulatoryReturn r = returns.findById(returnId)
                .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
            List<ReturnFilingInstance> insts = instances.findByReturnId(returnId);
            List<ReturnFilingInstance> removable = untouched.removable(insts);
            if (removable.size() != insts.size())
                throw ApiException.conflict("return_in_use",
                    "This return has filing periods with work on them and cannot be deleted");
            uploadLinks.deleteByReturnId(returnId);
            obligations.deleteObligationLinks(returnId);
            instances.deleteAll(insts);
            returns.delete(r);
            audit.log(userId, "return_deleted", "return", returnId,
                Collections.singletonMap("name", r.getReturnName()));
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
        boolean hasPerson = (ret.getResponsiblePersons() != null && !ret.getResponsiblePersons().isEmpty())
            || (ret.getResponsiblePerson() != null && !ret.getResponsiblePerson().isBlank());
        if (!hasPerson) return;
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
        ReturnFilingInstance instance = instances.save(ReturnFilingInstance.builder()
            .returnId(ret.getReturnId())
            .period(period).dueDate(due).prepStartDate(due.minusDays(offset))
            .filingChannel(ret.getFilingChannel())
            .currentStage(ReturnStage.NOT_STARTED)
            .status(ReturnFilingStatus.NOT_STARTED).build());
        escalationPolicyService.ensureFrozen(EscalationConstants.SUBJECT_RETURN, instance.getInstanceId(),
            ret.getEscalationPolicyId());
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
