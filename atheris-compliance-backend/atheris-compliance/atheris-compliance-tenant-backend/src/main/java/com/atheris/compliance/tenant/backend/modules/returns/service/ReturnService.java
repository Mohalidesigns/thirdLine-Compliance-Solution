package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.atheris.compliance.tenant.backend.modules.acts.entity.Act;
import com.atheris.compliance.tenant.backend.modules.acts.repository.ActRepository;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService;
import com.atheris.compliance.tenant.backend.modules.org.service.PersonDirectoryService;
import com.atheris.compliance.tenant.backend.modules.evidence.service.EvidenceVaultService;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationInstanceDto;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationLevelRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyDto;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationPolicy;
import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationTemplateService;
import com.atheris.compliance.tenant.backend.shared.email.EmailService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
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
import org.springframework.web.multipart.MultipartFile;
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
    private static final String INSTANCE_EVIDENCE_TYPE = "return_instance";
    private static final String DRAFT_EVIDENCE_PREFIX = "Draft report ";

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
    private final UserRepository users;
    private final EvidenceVaultService evidenceVault;
    private final NotificationTemplateService templates;
    private final EmailService email;
    private final PersonDirectoryService personDirectory;

    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private ReturnUploadLinkService uploadLinkService;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final java.time.format.DateTimeFormatter MAIL_DATE =
        java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy");

    @PersistenceContext
    private EntityManager em;

    private static final int PROJECTED_PERIODS = 3;

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
        if (policyId != null) repinFilings(ret, policyId);
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

    @Transactional(readOnly = true)
    public ReturnEscalationResponse resolveEscalation(Long returnId) {
        RegulatoryReturn r = returns.findById(returnId)
            .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
        EscalationInstanceDto config = escalationPolicyService.resolve(EscalationConstants.SUBJECT_RETURN, null,
            r.getEscalationPolicyId(), r.getFrequencyType());
        if (config == null) {
            return ReturnEscalationResponse.builder().active(false).build();
        }
        EscalationPolicyDto policy = config.getSourcePolicyId() == null ? null
            : escalationPolicyService.get(config.getSourcePolicyId());
        return ReturnEscalationResponse.builder()
            .policyId(config.getSourcePolicyId())
            .policyName(policy == null ? null : policy.getName())
            .frequencyScope(policy == null ? null : policy.getFrequencyScope())
            .isDefault(policy == null ? null : policy.getIsDefault())
            .active(config.getActive())
            .reminderStartValue(config.getReminderStartValue())
            .reminderStartUnit(config.getReminderStartUnit())
            .reminderRepeatValue(config.getReminderRepeatValue())
            .reminderRepeatUnit(config.getReminderRepeatUnit())
            .sendLink(config.getSendLink())
            .notifyOnStart(config.getNotifyOnStart())
            .levels(config.getLevels())
            .build();
    }

    @Transactional
    public ReturnRegisterItem updateEscalation(Long returnId, UpdateReturnEscalationRequest req, Integer userId) {
        try {
            RegulatoryReturn r = returns.findById(returnId)
                .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
            List<EscalationLevelRequest> levels = buildEscalationLevels(req);
            Integer startVal = req.getReminderStartValue();
            String startUnit = req.getReminderStartUnit();
            if (startVal == null) {
                EscalationPolicy def = escalationPolicyService
                    .defaultPolicy(EscalationConstants.SUBJECT_RETURN, r.getFrequencyType()).orElse(null);
                if (def != null) {
                    startVal = def.getReminderStartValue();
                    startUnit = def.getReminderStartUnit();
                }
            }
            EscalationPolicyRequest policyReq = EscalationPolicyRequest.builder()
                .name(r.getReturnName() + " escalation #" + r.getReturnId())
                .subjectType(EscalationConstants.SUBJECT_RETURN)
                .frequencyScope(r.getFrequencyType())
                .isDefault(false).isActive(true)
                .reminderStartValue(startVal)
                .reminderStartUnit(startUnit)
                .reminderRepeatValue(req.getReminderRepeatValue())
                .reminderRepeatUnit(req.getReminderRepeatUnit())
                .sendLink(true).notifyOnStart(true).levels(levels).build();
            Long policyId = r.getEscalationPolicyId();
            EscalationPolicyDto dto = policyId == null
                ? escalationPolicyService.create(policyReq, userId)
                : escalationPolicyService.update(policyId, policyReq, userId);
            r.setEscalationPolicyId(dto.getPolicyId());
            returns.save(r);
            repinFilings(r, dto.getPolicyId());
            audit.log(userId, "return_escalation_set", "return", returnId,
                Collections.singletonMap("policyId", String.valueOf(dto.getPolicyId())));
            return buildRegisterItem(r, instances.findByReturnId(returnId), LocalDate.now());
        } catch (Throwable e) {
            rollback();
            throw e instanceof RuntimeException re ? re : new RuntimeException(e);
        }
    }

    private void repinFilings(RegulatoryReturn r, Long policyId) {
        if (policyId == null) return;
        List<Long> ids = instances.findByReturnId(r.getReturnId()).stream()
            .map(ReturnFilingInstance::getInstanceId).toList();
        escalationPolicyService.refreshUntouchedFrozen(EscalationConstants.SUBJECT_RETURN, ids, policyId);
    }

    private List<EscalationLevelRequest> buildEscalationLevels(UpdateReturnEscalationRequest req) {
        List<EscalationLevelRequest> provided = req.getLevels();
        if (provided != null && !provided.isEmpty()) {
            List<EscalationLevelRequest> out = new ArrayList<>();
            int levelNo = 1;
            for (EscalationLevelRequest l : provided) {
                if (l == null) continue;
                String type = l.getTargetType() == null || l.getTargetType().isBlank()
                    ? EscalationConstants.TARGET_MANAGER : l.getTargetType().trim().toUpperCase();
                boolean role = EscalationConstants.TARGET_ROLE.equals(type) || "CCO".equals(type);
                if ("CCO".equals(type)) type = EscalationConstants.TARGET_ROLE;
                out.add(EscalationLevelRequest.builder()
                    .levelNo(levelNo++)
                    .afterValue(l.getAfterValue() != null ? l.getAfterValue() : 0)
                    .afterUnit(unit(l.getAfterUnit()))
                    .targetType(type)
                    .targetRole(role ? AppRole.CCO : null)
                    .targetUserId(role ? null : l.getTargetUserId())
                    .targetName(role ? null : l.getTargetName())
                    .targetEmail(role ? null : l.getTargetEmail())
                    .build());
            }
            if (!out.isEmpty()) return out;
        }
        return List.of(
            EscalationLevelRequest.builder().levelNo(1).afterValue(0).afterUnit(EscalationConstants.UNIT_DAYS)
                .targetType(EscalationConstants.TARGET_ASSIGNEE).build(),
            EscalationLevelRequest.builder().levelNo(2).afterValue(3).afterUnit(EscalationConstants.UNIT_DAYS)
                .targetType(EscalationConstants.TARGET_MANAGER).build(),
            EscalationLevelRequest.builder().levelNo(3).afterValue(7).afterUnit(EscalationConstants.UNIT_DAYS)
                .targetType(EscalationConstants.TARGET_MANAGER_OF_MANAGER).targetRole(AppRole.CCO).build());
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

    @Transactional(readOnly = true)
    public boolean isFilingOpenForData(Long instanceId) {
        ReturnFilingInstance inst = instances.findById(instanceId).orElse(null);
        return inst != null && earlierOpenFiling(inst) == null;
    }

    private ReturnFilingInstance earlierOpenFiling(ReturnFilingInstance inst) {
        if (inst.getDueDate() == null) return null;
        for (ReturnFilingInstance other : instances.findByReturnId(inst.getReturnId())) {
            if (other.getInstanceId().equals(inst.getInstanceId())) continue;
            if (other.isPendingReview()) continue;
            if (isSubmitted(other.getStatus() != null ? other.getStatus().db() : null)) continue;
            if (other.getDueDate() != null && other.getDueDate().isBefore(inst.getDueDate())) return other;
        }
        return null;
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
            .returnOwnerName(r.getReturnOwnerName())
            .filingChannel(r.getFilingChannel())
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
            return b.projectedInstances(projectedPeriods(r, insts)).totalInstances(0).overdueCount(0).hasOverdue(false).build();
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
            if (currentEvent == null) return b.projectedInstances(List.of()).totalInstances(insts.size())
                .overdueCount((int) eventOverdue).hasOverdue(eventOverdue > 0).build();
            return b.currentPeriod(currentEvent.getTriggerDate().toString()).currentDueDate(currentEvent.getDueDate())
                .deadline(deadlineOf(r, currentEvent.getDueDate()))
                .currentStatus(currentEvent.getStatus() != null ? currentEvent.getStatus().db() : null)
                .currentStage(currentEvent.getCurrentStage() != null ? currentEvent.getCurrentStage().db() : null)
                .currentInstanceId(currentEvent.getInstanceId()).projectedInstances(List.of())
                .totalInstances(insts.size()).overdueCount((int) eventOverdue).hasOverdue(eventOverdue > 0).build();
        }

        ReturnFilingInstance current = currentInstance(insts);
        if (current == null) return null;

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
            .projectedInstances(projectedPeriods(r, insts))
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
        ReturnStage from = inst.getCurrentStage();
        int idx = STAGES.indexOf(from);
        if (idx < 0 || idx >= STAGES.size() - 1)
            throw ApiException.conflict("invalid_transition", "Cannot advance from stage: "
                + (from != null ? from.db() : "none"));
        if (from == ReturnStage.DATA_GATHERING)
            throw ApiException.conflict("data_review_required",
                "Review and accept the submitted data before moving to Draft");
        if (from == ReturnStage.DRAFT)
            throw ApiException.conflict("draft_upload_required",
                "Attach the drafted report to send it to the CCO for review");
        if (from == ReturnStage.REVIEW)
            throw ApiException.conflict("report_review_required",
                "The CCO must accept or request changes at the Review stage");
        ReturnStage next = STAGES.get(idx + 1);

        Map<String, Map<String, String>> stageData = parseStageData(inst.getStageData());
        Map<String, String> stageEntry = new HashMap<>();
        stageEntry.put("completedAt", Instant.now().toString());
        stageEntry.put("completedByUserId", String.valueOf(userId));
        if (req.getCompletedByName() != null) stageEntry.put("completedByName", req.getCompletedByName());
        if (req.getEvidenceUrl() != null) stageEntry.put("evidenceUrl", req.getEvidenceUrl());
        stageData.put(from.db(), stageEntry);
        try {
            inst.setStageData(MAPPER.writeValueAsString(stageData));
        } catch (Exception e) { throw new IllegalStateException("Failed to serialize stage data", e); }

        inst.setCurrentStage(next);
        inst.setStatus(ReturnFilingStatus.IN_PROGRESS);
        inst.setStageOwnerUserId(userId);
        instances.save(inst);
        audit.log(userId, "return_stage_advanced", "return_instance", instanceId,
            Map.of("from", from.db(), "to", next.db()));
        if (from == ReturnStage.NOT_STARTED && next == ReturnStage.DATA_GATHERING) {
            try {
                RegulatoryReturn started = returns.findById(inst.getReturnId()).orElse(null);
                if (started != null) sendFilingRequest(started, inst, userId);
            } catch (Throwable e) {
                log.warn("Filing link mail failed for instance {}: {}", instanceId, e.getMessage());
            }
        }
    }

    @Transactional
    public FilingLinkSentResponse sendFilingLink(Long returnId, Integer userId) {
        try {
            RegulatoryReturn ret = returns.findById(returnId)
                .orElseThrow(() -> ApiException.notFound("Return not found: " + returnId));
            if (ret.getStatus() != RegulatoryReturnStatus.ACTIVE)
                throw ApiException.conflict("return_inactive", "This return is inactive.");
            ReturnFilingInstance inst = currentInstance(instances.findByReturnId(returnId));
            if (inst == null)
                throw ApiException.conflict("no_open_period", "This return has no open filing period to link to.");
            FilingLinkSentResponse sent = sendFilingRequest(ret, inst, userId);
            if (sent == null)
                throw ApiException.conflict("no_recipient",
                    "No responsible person with a known email — add one before sending the link.");
            audit.log(userId, "return_filing_link_sent", "return", returnId,
                Map.of("instanceId", String.valueOf(inst.getInstanceId())));
            return sent;
        } catch (RuntimeException e) {
            rollback();
            throw e;
        }
    }

    private FilingLinkSentResponse sendFilingRequest(RegulatoryReturn ret, ReturnFilingInstance inst, Integer userId) {
        List<String> names = ret.getResponsiblePersons() == null || ret.getResponsiblePersons().isEmpty()
            ? (ret.getResponsiblePerson() == null ? List.of() : List.of(ret.getResponsiblePerson()))
            : ret.getResponsiblePersons();
        List<PersonDirectoryService.Entry> people = personDirectory.resolve(names);
        if (people.isEmpty()) {
            log.warn("No responsible person with a known email on return {} — filing link not sent", ret.getReturnId());
            return null;
        }
        String raw = uploadLinkService.createFilingLink(ret.getReturnId(), inst.getInstanceId(),
            people.get(0).email(), people.get(0).name(), userId);
        List<String> cc = new ArrayList<>();
        String owner = ownerEmail(ret);
        if (owner != null) cc.add(owner);
        ReturnUploadLinkService.FilingMail mail = null;
        for (PersonDirectoryService.Entry person : people) {
            ReturnUploadLinkService.FilingMail sent =
                uploadLinkService.sendFilingRequest(ret, inst, person.email(), cc, person.name(), raw);
            if (mail == null) mail = sent;
        }
        return FilingLinkSentResponse.builder()
            .path(uploadLinkService.uploadPath(raw))
            .recipients(people.stream().map(PersonDirectoryService.Entry::email).toList())
            .cc(cc)
            .subject(mail == null ? null : mail.subject())
            .body(mail == null ? null : mail.body())
            .build();
    }

    @Transactional
    public void submitDraft(Long instanceId, List<MultipartFile> files, String notes, Integer userId) {
        try {
            ReturnFilingInstance inst = instances.findById(instanceId)
                .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId));
            if (inst.getCurrentStage() != ReturnStage.DRAFT)
                throw ApiException.conflict("invalid_transition",
                    "The drafted report can only be submitted from the Draft stage.");
            List<MultipartFile> attached = files == null ? List.of()
                : files.stream().filter(f -> f != null && !f.isEmpty()).toList();
            if (attached.isEmpty())
                throw ApiException.conflict("draft_evidence_required",
                    "Attach the drafted report before sending it to the CCO.");
            int version = draftFileCount(instanceId) + 1;
            String reference = DRAFT_EVIDENCE_PREFIX + inst.getPeriod() + " (v" + version + ")";
            for (MultipartFile file : attached) {
                evidenceVault.upload(file, INSTANCE_EVIDENCE_TYPE, instanceId, reference, userId);
            }
            if (notes != null && !notes.isBlank()) inst.setNotes(notes.trim());
            advanceToReview(inst, userId, reference);
        } catch (Throwable e) {
            log.error("Submitting the draft for instance {} failed: {}", instanceId, e.getMessage(), e);
            try { em.clear(); } catch (Throwable ignored) {}
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
            throw e instanceof RuntimeException ? (RuntimeException) e : new RuntimeException(e);
        }
    }

    private int draftFileCount(Long instanceId) {
        return (int) evidenceVault.listBySource(INSTANCE_EVIDENCE_TYPE, instanceId).stream()
            .filter(f -> f.getDescription() != null && f.getDescription().startsWith(DRAFT_EVIDENCE_PREFIX))
            .count();
    }

    private void advanceToReview(ReturnFilingInstance inst, Integer userId, String evidenceRef) {
        Map<String, Map<String, String>> stageData = parseStageData(inst.getStageData());
        Map<String, String> stageEntry = new HashMap<>();
        stageEntry.put("completedAt", Instant.now().toString());
        stageEntry.put("completedByUserId", String.valueOf(userId));
        stageData.put(ReturnStage.DRAFT.db(), stageEntry);
        try {
            inst.setStageData(MAPPER.writeValueAsString(stageData));
        } catch (Exception e) { throw new IllegalStateException("Failed to serialize stage data", e); }
        String submitter = users.findById(userId).map(User::getFullName).orElse(null);
        inst.setCurrentStage(ReturnStage.REVIEW);
        inst.setStatus(ReturnFilingStatus.IN_PROGRESS);
        inst.setStageOwnerUserId(userId);
        inst.setPendingReview(true);
        inst.setReviewEvidenceRef(evidenceRef);
        inst.setReviewSubmittedAt(Instant.now());
        inst.setReviewSubmittedByName(submitter);
        inst.setReviewSubmittedByEmail(null);
        inst.setReviewSubmittedByUserId(userId);
        inst.setReviewDecision(null);
        inst.setReviewNotes(null);
        inst.setReviewedAt(null);
        inst.setReviewedByUserId(null);
        instances.save(inst);
        audit.log(userId, "return_stage_advanced", "return_instance", inst.getInstanceId(),
            Map.of("from", ReturnStage.DRAFT.db(), "to", ReturnStage.REVIEW.db()));
        RegulatoryReturn ret = returns.findById(inst.getReturnId()).orElse(null);
        String link = filingMailLink(inst, "report");
        notifications.notifyRole(AppRole.CCO, NotificationConstants.CATEGORY_RETURNS,
            NotificationConstants.SEVERITY_MEDIUM, filingMailSummary(inst, ret, "Review report"), link);
        if (ret != null) {
            Map<String, String> vars = filingMailVars(ret, inst);
            sendFilingMail(EscalationConstants.KEY_RETURN_REPORT_REVIEW,
                "Review required: " + ret.getReturnName(), vars, roleEmails(AppRole.CCO),
                ownerCc(ret, roleEmails(AppRole.CCO)), link);
        }
    }

    private String filingMailLink(ReturnFilingInstance inst, String gate) {
        return "/returns/" + inst.getReturnId() + "?instanceId=" + inst.getInstanceId() + "&review=" + gate;
    }

    private String filingMailSummary(ReturnFilingInstance inst, RegulatoryReturn ret, String label) {
        String name = ret != null && ret.getReturnName() != null ? ret.getReturnName() : ("Filing " + inst.getPeriod());
        return label + ": " + name;
    }

    private Map<String, String> filingMailVars(RegulatoryReturn ret, ReturnFilingInstance inst) {
        Map<String, String> vars = new HashMap<>();
        vars.put("returnName", blankToEmpty(ret.getReturnName()));
        vars.put("actObligation", blankToEmpty(firstNonBlank(ret.getActName(), obligationFallbackTitle(ret))));
        vars.put("regulator", blankToEmpty(ret.getFilingRegulator()));
        vars.put("responsiblePerson", blankToEmpty(responsibleLabel(ret)));
        vars.put("dueDate", inst.getDueDate() == null ? "" : MAIL_DATE.format(inst.getDueDate()));
        vars.put("period", blankToEmpty(inst.getPeriod()));
        return vars;
    }

    private static String blankToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String responsibleLabel(RegulatoryReturn ret) {
        List<String> persons = ret.getResponsiblePersons() == null ? List.of() : ret.getResponsiblePersons();
        if (!persons.isEmpty()) return String.join(", ", persons);
        return ret.getResponsiblePerson();
    }

    private List<String> roleEmails(String role) {
        return users.findByRole(role).stream()
            .filter(u -> !Boolean.FALSE.equals(u.getIsActive()))
            .map(User::getEmail)
            .filter(e -> e != null && !e.isBlank())
            .toList();
    }

    private String ownerEmail(RegulatoryReturn ret) {
        if (ret == null || ret.getReturnOwnerUserId() == null) return null;
        return users.findById(ret.getReturnOwnerUserId()).map(User::getEmail)
            .filter(e -> e != null && !e.isBlank()).orElse(null);
    }

    private List<String> responsibleCc(RegulatoryReturn ret, List<String> to) {
        if (ret == null) return List.of();
        List<String> names = ret.getResponsiblePersons() == null || ret.getResponsiblePersons().isEmpty()
            ? (ret.getResponsiblePerson() == null || ret.getResponsiblePerson().isBlank()
                ? List.of() : List.of(ret.getResponsiblePerson()))
            : ret.getResponsiblePersons();
        return personDirectory.resolve(names).stream()
            .map(PersonDirectoryService.Entry::email)
            .filter(e -> e != null && !e.isBlank())
            .filter(e -> to == null || to.stream().noneMatch(t -> t.equalsIgnoreCase(e)))
            .distinct().toList();
    }

    private List<String> ownerCc(RegulatoryReturn ret, List<String> to) {
        String owner = ownerEmail(ret);
        if (owner == null) return List.of();
        if (to != null && to.stream().anyMatch(e -> e.equalsIgnoreCase(owner))) return List.of();
        return List.of(owner);
    }

    private void sendFilingMail(String templateKey, String fallbackSubject, Map<String, String> vars,
                                List<String> to, List<String> cc, String link) {
        if (to == null || to.isEmpty()) return;
        NotificationTemplateService.RenderedEmail rendered = templates.render(templateKey, vars);
        String subject = rendered.subject() != null ? rendered.subject() : fallbackSubject;
        String body = rendered.body() != null ? rendered.body() : fallbackSubject;
        String absoluteLink = link == null ? null : email.baseUrl() + link;
        for (String recipient : to) {
            email.send(recipient, cc, subject, body, absoluteLink);
        }
    }

    private List<String> analystRecipients(ReturnFilingInstance inst) {
        if (inst.getStageOwnerUserId() != null) {
            List<String> byUser = users.findById(inst.getStageOwnerUserId()).map(User::getEmail)
                .filter(e -> e != null && !e.isBlank()).map(e -> List.of(e)).orElse(List.of());
            if (!byUser.isEmpty()) return byUser;
        }
        return roleEmails(AppRole.ANALYST);
    }

    @Transactional
    public void submitFromLink(Long instanceId, String evidenceRef, String submittedByName, String submittedByEmail, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId));
        if (inst.getCurrentStage() == ReturnStage.COMPLETED)
            throw ApiException.conflict("already_completed", "This filing is already completed.");
        ReturnFilingInstance earlier = earlierOpenFiling(inst);
        if (earlier != null)
            throw ApiException.conflict("previous_period_open",
                "The earlier filing for period " + earlier.getPeriod()
                    + " is still open — submit that one first.");
        if (inst.getCurrentStage() == ReturnStage.NOT_STARTED) inst.setCurrentStage(ReturnStage.DATA_GATHERING);
        if (inst.getCurrentStage() != ReturnStage.DATA_GATHERING)
            throw ApiException.conflict("not_awaiting_data",
                "Filing data can only be submitted at the Data Gathering stage.");
        inst.setStatus(ReturnFilingStatus.IN_PROGRESS);
        inst.setReviewEvidenceRef(evidenceRef);
        inst.setReviewSubmittedAt(Instant.now());
        inst.setReviewSubmittedByName(submittedByName);
        inst.setReviewSubmittedByEmail(submittedByEmail);
        inst.setReviewSubmittedByUserId(userId);
        inst.setPendingReview(true);
        inst.setReviewDecision(null);
        inst.setReviewNotes(null);
        inst.setReviewedAt(null);
        inst.setReviewedByUserId(null);
        instances.save(inst);
        audit.log(userId, "return_data_submitted", "return_instance", instanceId, Map.of());
        RegulatoryReturn ret = returns.findById(inst.getReturnId()).orElse(null);
        String link = filingMailLink(inst, "data");
        String summary = filingMailSummary(inst, ret, "Review data");
        if (inst.getStageOwnerUserId() != null) {
            notifications.notifyUser(inst.getStageOwnerUserId(), NotificationConstants.CATEGORY_RETURNS,
                NotificationConstants.SEVERITY_MEDIUM, summary, link);
        } else {
            notifications.notifyRole(AppRole.ANALYST, NotificationConstants.CATEGORY_RETURNS,
                NotificationConstants.SEVERITY_MEDIUM, summary, link);
        }
        if (ret != null) {
            Map<String, String> vars = filingMailVars(ret, inst);
            List<String> to = analystRecipients(inst);
            sendFilingMail(EscalationConstants.KEY_RETURN_DATA_REVIEW,
                "Filing data submitted: " + ret.getReturnName(), vars, to, ownerCc(ret, to), link);
            if (inst.getReviewSubmittedByEmail() != null && !inst.getReviewSubmittedByEmail().isBlank()) {
                List<String> receiptTo = List.of(inst.getReviewSubmittedByEmail());
                sendFilingMail(EscalationConstants.KEY_RETURN_DATA_RECEIPT,
                    "Received: " + ret.getReturnName() + " filing data", vars,
                    receiptTo, responsibleCc(ret, receiptTo), null);
            }
        }
    }

    @Transactional
    public void review(Long instanceId, String decision, String notes, Integer userId) {
        ReturnFilingInstance inst = instances.findById(instanceId)
            .orElseThrow(() -> ApiException.notFound("Return instance not found: " + instanceId));
        ReturnStage stage = inst.getCurrentStage();
        if (!inst.isPendingReview())
            throw ApiException.conflict("not_awaiting_review", "This filing is not awaiting review.");
        boolean accept = decision != null && decision.equalsIgnoreCase("ACCEPT");
        inst.setReviewedAt(Instant.now());
        inst.setReviewedByUserId(userId);
        inst.setReviewNotes(notes);
        inst.setPendingReview(false);
        if (stage == ReturnStage.DATA_GATHERING) {
            if (accept) {
                inst.setReviewDecision("ACCEPTED");
                inst.setCurrentStage(ReturnStage.DRAFT);
            } else {
                inst.setReviewDecision("REJECTED");
                String email = inst.getReviewSubmittedByEmail();
                String name = inst.getReviewSubmittedByName();
                inst.setReviewEvidenceRef(null);
                inst.setReviewSubmittedAt(null);
                inst.setReviewSubmittedByName(null);
                inst.setReviewSubmittedByEmail(null);
                inst.setReviewSubmittedByUserId(null);
                resendDataLink(inst, email, name, userId);
            }
        } else if (stage == ReturnStage.REVIEW) {
            if (accept) {
                inst.setReviewDecision("ACCEPTED");
                complete(inst, userId);
            } else {
                inst.setReviewDecision("CHANGES_REQUESTED");
                inst.setCurrentStage(ReturnStage.DRAFT);
                RegulatoryReturn ret = returns.findById(inst.getReturnId()).orElse(null);
                String link = "/returns/" + inst.getReturnId() + "?instanceId=" + inst.getInstanceId();
                notifications.notifyRole(AppRole.ANALYST, NotificationConstants.CATEGORY_RETURNS,
                    NotificationConstants.SEVERITY_MEDIUM, filingMailSummary(inst, ret, "Changes requested"), link);
                if (ret != null) {
                    List<String> to = roleEmails(AppRole.ANALYST);
                    sendFilingMail(EscalationConstants.KEY_RETURN_CHANGES_REQUESTED,
                        "Changes requested: " + ret.getReturnName(), filingMailVars(ret, inst), to,
                        ownerCc(ret, to), link);
                }
            }
        } else {
            throw ApiException.conflict("not_awaiting_review", "This filing is not awaiting review.");
        }
        instances.save(inst);
        if (inst.getCurrentStage() == ReturnStage.COMPLETED) rollForward(inst.getReturnId());
        audit.log(userId, "return_reviewed", "return_instance", instanceId,
            Map.of("stage", stage.db(), "decision", String.valueOf(inst.getReviewDecision())));
    }

    private void complete(ReturnFilingInstance inst, Integer userId) {
        LocalDate today = LocalDate.now();
        boolean late = inst.getDueDate() != null && today.isAfter(inst.getDueDate());
        int daysLate = late ? (int) ChronoUnit.DAYS.between(inst.getDueDate(), today) : 0;
        inst.setCurrentStage(ReturnStage.COMPLETED);
        inst.setStatus(late ? ReturnFilingStatus.SUBMITTED_LATE : ReturnFilingStatus.SUBMITTED);
        inst.setSubmittedDate(today);
        inst.setSubmittedByUserId(userId);
        inst.setSubmissionEvidenceUrl(inst.getReviewEvidenceRef());
        inst.setDaysLate(daysLate);
        inst.setCompletedAt(Instant.now());
        inst.setEscalationLevel(0);
        inst.setEscalatedAt(null);
    }

    private static String unit(String u) {
        return EscalationConstants.UNIT_HOURS.equalsIgnoreCase(u == null ? "" : u)
            ? EscalationConstants.UNIT_HOURS : EscalationConstants.UNIT_DAYS;
    }

    private void resendDataLink(ReturnFilingInstance inst, String email, String name, Integer userId) {
        if (email == null || email.isBlank()) return;
        try {
            String raw = uploadLinkService.createFilingLink(inst.getReturnId(), inst.getInstanceId(), email, name, userId);
            uploadLinkService.emailFilingLink(inst.getReturnId(), email, name, raw);
        } catch (Exception e) {
            log.warn("Resend filing link failed for instance {}: {}", inst.getInstanceId(), e.getMessage());
        }
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

        // The governing act is optional at create: linkObligations backfills it from the first linked obligation.
        Act act = req.getActId() != null ? resolveAct(req.getActId()) : null;

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
        Integer ownerUserId = req.getReturnOwnerUserId();
        String ownerName = req.getReturnOwnerName();
        if (ownerUserId == null && ownerName != null && !ownerName.isBlank()) {
            User owner = users.findByEmail(ownerName)
                .orElseGet(() -> users.findFirstByFullNameIgnoreCase(ownerName).orElse(null));
            if (owner != null) ownerUserId = owner.getUserId();
        }
        RegulatoryReturn r = RegulatoryReturn.builder()
            .returnName(req.getReturnName()).filingRegulator(snapshot)
            .tenantRegulatorId(reg != null ? reg.getId() : req.getTenantRegulatorId())
            .actId(act != null ? act.getRegulationId() : null)
            .actName(act != null ? act.getName() : null)
            .returnType(req.getReturnType())
            .frequency(freq != null ? freq.label() : null)
            .frequencyType(freq != null ? freq.name() : ReturnFrequency.MONTHLY.name())
            .filingDate(anchor)
            .dueDaysAfterPeriodEnd(offsetDays)
            .dueDateSource(ruleType != null ? DueRule.SOURCE_USER : null)
            .filingDeadlineOffsetDays(req.getFilingDeadlineOffsetDays())
            .filingChannel(req.getFilingChannel())
            .returnOwnerUserId(ownerUserId)
            .returnOwnerName(ownerName)
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
        for (ObligationRepository.LinkedObligationRow o : obligations.findLinkedObligationDetails(r.getReturnId())) {
            String label = firstNonBlank(o.getActName(), o.getTitle(), o.getName(),
                truncate(o.getPlainEnglishStatement(), 120));
            if (label != null) return label;
            if (o.getObligationId() != null) return "Obligation #" + o.getObligationId();
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v.trim();
        }
        return null;
    }

    private static String truncate(String text, int max) {
        if (text == null || text.isBlank()) return null;
        String t = text.trim();
        return t.length() <= max ? t : t.substring(0, max - 1).trim() + "…";
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

    public void ensureInstances(RegulatoryReturn ret) {
        boolean hasPerson = (ret.getResponsiblePersons() != null && !ret.getResponsiblePersons().isEmpty())
            || (ret.getResponsiblePerson() != null && !ret.getResponsiblePerson().isBlank());
        if (!hasPerson) return;
        ReturnPeriods.Step step = ReturnPeriods.stepFor(ret.getFrequencyType());
        if (step == null) return;
        DueRule rule = DueRule.of(ret);
        if (step.unit() == ReturnPeriods.Unit.MONTH && rule == null) return;

        List<ReturnFilingInstance> existing = reconcileFirstDueDate(ret, step, rule);
        if (existing.stream().anyMatch(ReturnService::isOpen)) return;
        Set<String> seen = existing.stream().map(ReturnFilingInstance::getPeriod)
            .filter(Objects::nonNull).collect(Collectors.toCollection(HashSet::new));

        ReturnPeriods.Occurrence occ = ReturnPeriods.next(ret, step, rule,
            latestDueDate(existing), LocalDate.now());
        materializeAt(ret, occ.period(), occ.due(), seen);
    }

    private List<ReturnFilingInstance> reconcileFirstDueDate(RegulatoryReturn ret, ReturnPeriods.Step step, DueRule rule) {
        List<ReturnFilingInstance> existing = instances.findByReturnId(ret.getReturnId());
        if (rule == null || rule.kind() != DueRule.Kind.DATE
                || !DueRule.SOURCE_USER.equals(ret.getDueDateSource()) || existing.isEmpty()) return existing;
        String anchorPeriod = ReturnPeriods.labelOf(rule.firstDueDate(), step);
        if (existing.stream().anyMatch(i -> anchorPeriod.equals(i.getPeriod()))) return existing;
        List<ReturnFilingInstance> removable = untouched.removable(existing);
        if (removable.size() != existing.size()) return existing;
        instances.deleteAll(removable);
        instances.flush();
        log.info("Return {} periods rebuilt to its first due date {} ({} stale period(s) removed)",
            ret.getReturnId(), rule.firstDueDate(), removable.size());
        audit.log(null, "return_periods_reconciled", "return", ret.getReturnId(),
            Map.of("firstDueDate", rule.firstDueDate().toString(), "removed", String.valueOf(removable.size())));
        return instances.findByReturnId(ret.getReturnId());
    }

    private static ReturnFilingInstance currentInstance(List<ReturnFilingInstance> insts) {
        return insts.stream()
            .filter(ReturnService::isOpen)
            .min(Comparator.comparing(ReturnFilingInstance::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
            .orElseGet(() -> insts.stream()
                .max(Comparator.comparing(ReturnFilingInstance::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null));
    }

    private static boolean isOpen(ReturnFilingInstance instance) {
        ReturnFilingStatus st = instance.getStatus();
        return st != ReturnFilingStatus.SUBMITTED && st != ReturnFilingStatus.SUBMITTED_LATE;
    }

    private static LocalDate latestDueDate(List<ReturnFilingInstance> existing) {
        return existing.stream().map(ReturnFilingInstance::getDueDate).filter(Objects::nonNull)
            .max(Comparator.naturalOrder()).orElse(null);
    }

    private List<ReturnRegisterItem.ProjectedPeriod> projectedPeriods(RegulatoryReturn ret,
                                                                      List<ReturnFilingInstance> insts) {
        ReturnPeriods.Step step = ReturnPeriods.stepFor(ret.getFrequencyType());
        DueRule rule = DueRule.of(ret);
        if (step == null || (step.unit() == ReturnPeriods.Unit.MONTH && rule == null)) return List.of();
        return ReturnPeriods.project(ret, step, rule, latestDueDate(insts), LocalDate.now(), PROJECTED_PERIODS).stream()
            .map(o -> ReturnRegisterItem.ProjectedPeriod.builder().period(o.period()).dueDate(o.due()).build())
            .toList();
    }

    private void rollForward(Long returnId) {
        returns.findById(returnId).ifPresent(r -> {
            if (r.getStatus() == RegulatoryReturnStatus.ACTIVE) ensureInstances(r);
        });
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
            ret.getEscalationPolicyId(), ret.getFrequencyType());
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
