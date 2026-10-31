package com.atheris.compliance.tenant.backend.modules.tasks.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTaskRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationPolicy;
import com.atheris.compliance.tenant.backend.modules.escalation.repository.EscalationPolicyRepository;
import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.RegulatoryReturn;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnStage;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.modules.tasks.dto.TaskItemDto;
import com.atheris.compliance.tenant.backend.modules.tasks.dto.TaskStatsDto;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class TaskCenterService {

    public static final String CATEGORY_RETURNS = "RETURNS";
    public static final String CATEGORY_CONTROLS = "CONTROLS";
    public static final String CATEGORY_FINDINGS = "FINDINGS";
    public static final String CATEGORY_OBLIGATIONS = "OBLIGATIONS";

    private static final int CONTROL_DUE_SOON_DAYS = 30;
    private static final int FINDING_DUE_SOON_DAYS = 7;
    private static final Map<String, Integer> RANK =
        Map.of("OVERDUE", 0, "HIGH", 1, "MEDIUM", 2, "SOON", 3, "LOW", 4);

    private final ReturnFilingInstanceRepository instances;
    private final RegulatoryReturnRepository returns;
    private final EscalationPolicyRepository policies;
    private final EscalationPolicyService policyService;
    private final ControlTaskRepository controlTasks;
    private final ControlTestResultRepository testResults;
    private final ControlRepository controls;
    private final FindingRepository findings;
    private final ObligationClassificationRepository classifications;
    private final ObligationRepository obligations;

    @Transactional(readOnly = true)
    public Page<TaskItemDto> page(String assignee, String category, String priority, String q,
                                  Integer ownerUserId, Integer currentUserId, String currentUserRole, Pageable pageable) {
        List<TaskItemDto> all = build(assignee, category, priority, q, ownerUserId, currentUserId, currentUserRole);
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), all.size());
        List<TaskItemDto> slice = start >= all.size() ? List.of() : all.subList(start, end);
        return new PageImpl<>(slice, pageable, all.size());
    }

    @Transactional(readOnly = true)
    public List<TaskItemDto> build(String assignee, String category, String priority, String q,
                                   Integer ownerUserId, Integer currentUserId, String currentUserRole) {
        List<TaskItemDto> all = new ArrayList<>();
        all.addAll(returnsTasks());
        all.addAll(controlsTasks());
        all.addAll(findingsTasks());
        all.addAll(obligationsTasks());
        boolean mine = !"all".equalsIgnoreCase(assignee == null || assignee.isBlank() ? "me" : assignee);
        return all.stream()
            .filter(t -> !mine || (t.getOwnerUserId() != null && t.getOwnerUserId().equals(currentUserId)) || actionableByRole(t, currentUserRole))
            .filter(t -> category == null || category.isBlank() || category.equalsIgnoreCase(t.getCategory()))
            .filter(t -> priority == null || priority.isBlank() || priority.equalsIgnoreCase(t.getPriority()))
            .filter(t -> ownerUserId == null || ownerUserId.equals(t.getOwnerUserId()))
            .filter(t -> matches(t, q))
            .sorted(Comparator
                .comparingInt((TaskItemDto t) -> RANK.getOrDefault(t.getPriority(), 9))
                .thenComparing(TaskItemDto::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
    }

    private static final Set<String> ROLE_ACTIONABLE = Set.of(
        "RETURN_REPORT_REVIEW", "CONTROL_TEST_ASSIGN", "CONTROL_TEST_AWAITING_REVIEW",
        "FINDING_UNASSIGNED", "FINDING_AWAITING_REVIEW", "OBLIGATION_NO_CONTROL");

    private static boolean actionableByRole(TaskItemDto task, String role) {
        if (task == null || role == null || task.getOwnerUserId() != null) return false;
        if (!AppRole.ANALYST.equals(role) && !AppRole.CCO.equals(role) && !AppRole.TENANT_ADMIN.equals(role)) {
            return false;
        }
        return ROLE_ACTIONABLE.contains(task.getType());
    }

    @Transactional(readOnly = true)
    public TaskStatsDto stats(String assignee, String category, Integer ownerUserId, Integer currentUserId, String currentUserRole) {
        List<TaskItemDto> all = build(assignee, null, null, null, ownerUserId, currentUserId, currentUserRole);
        List<TaskItemDto> scoped = category == null || category.isBlank() ? all
            : all.stream().filter(t -> category.equalsIgnoreCase(t.getCategory())).toList();
        LocalDate today = LocalDate.now();
        java.time.Instant cutoff = java.time.Instant.now().minus(7, ChronoUnit.DAYS);
        long completed = instances.countByStatusInAndCompletedAtGreaterThanEqual(
                List.of(ReturnFilingStatus.SUBMITTED, ReturnFilingStatus.SUBMITTED_LATE), cutoff)
            + findings.countByClosedAtGreaterThanEqual(cutoff)
            + testResults.countByReviewedAtGreaterThanEqual(cutoff);
        long backlog = build("all", null, null, null, null, null, null).size();
        return TaskStatsDto.builder()
            .total(scoped.size())
            .backlog(backlog)
            .overdue(scoped.stream().filter(t -> "OVERDUE".equals(t.getPriority())).count())
            .dueToday(scoped.stream().filter(t -> t.getDueDate() != null && t.getDueDate().isEqual(today)).count())
            .dueThisWeek(scoped.stream().filter(t -> t.getDueDate() != null
                && !t.getDueDate().isBefore(today) && !t.getDueDate().isAfter(today.plusDays(7))).count())
            .unassigned(scoped.stream().filter(t -> t.getOwnerUserId() == null).count())
            .completedLast7d(completed)
            .byCategory(all.stream().collect(Collectors.groupingBy(TaskItemDto::getCategory, Collectors.counting())))
            .byPriority(scoped.stream().collect(Collectors.groupingBy(TaskItemDto::getPriority, Collectors.counting())))
            .build();
    }

    private List<TaskItemDto> returnsTasks() {
        LocalDate today = LocalDate.now();
        Map<Long, TaskItemDto> out = new LinkedHashMap<>();

        List<ReturnFilingInstance> open = instances.findByStatusNotInAndDueDateBetweenOrderByDueDateAsc(
            List.of(ReturnFilingStatus.SUBMITTED, ReturnFilingStatus.SUBMITTED_LATE),
            today.minusDays(400), today.plusDays(120));
        Set<Long> ids = open.stream().map(ReturnFilingInstance::getReturnId).collect(Collectors.toSet());
        Map<Long, RegulatoryReturn> byId = new HashMap<>();
        if (!ids.isEmpty()) for (RegulatoryReturn r : returns.findAllById(ids)) byId.put(r.getReturnId(), r);

        for (ReturnFilingInstance i : open) {
            RegulatoryReturn r = byId.get(i.getReturnId());
            if (r == null || i.getDueDate() == null) continue;
            long days = ChronoUnit.DAYS.between(today, i.getDueDate());
            int lead = leadDays(r);
            ReturnStage stage = i.getCurrentStage();
            boolean escalated = i.getEscalationLevel() != null && i.getEscalationLevel() > 0;

            if (i.isPendingReview()) {
                String rtype, rlabel;
                if (stage == ReturnStage.DATA_GATHERING) { rtype = "RETURN_DATA_REVIEW"; rlabel = "Review data"; }
                else if (stage == ReturnStage.REVIEW) { rtype = "RETURN_REPORT_REVIEW"; rlabel = "Review report"; }
                else continue;
                Integer reviewOwner = stage == ReturnStage.DATA_GATHERING
                    ? (i.getStageOwnerUserId() != null ? i.getStageOwnerUserId() : r.getReturnOwnerUserId()) : null;
                merge(out, i.getReturnId(), TaskItemDto.builder()
                    .id(i.getInstanceId()).key("return:" + i.getInstanceId())
                    .type(rtype).category(CATEGORY_RETURNS)
                    .title(r.getReturnName()).caption(caption(r, i))
                    .regulator(r.getFilingRegulator()).responsiblePerson(responsibleLabel(r))
                    .priority("HIGH").dueDate(i.getDueDate()).daysRemaining((int) days)
                    .ownerName(r.getReturnOwnerName()).ownerUserId(reviewOwner)
                    .stage(stage.db())
                    .linkPath("/returns/" + r.getReturnId() + "?instanceId=" + i.getInstanceId()
                        + "&review=" + (stage == ReturnStage.DATA_GATHERING ? "data" : "report"))
                    .actionLabel(rlabel).actionType("OPEN")
                    .sourceRef(Map.of("returnId", r.getReturnId(), "instanceId", i.getInstanceId()))
                    .build());
                continue;
            }

            String type, priority, action, label;
            if (days < 0) {
                type = "RETURN_OVERDUE"; priority = "OVERDUE"; action = "OPEN"; label = "Open";
            } else if (escalated) {
                type = "RETURN_ESCALATED"; priority = "HIGH"; action = "OPEN"; label = "Open";
            } else if (days <= lead) {
                if (stage == ReturnStage.NOT_STARTED) {
                    type = "RETURN_START_READY"; priority = "SOON"; action = "START"; label = "Start filing";
                } else {
                    type = "RETURN_DUE_SOON"; priority = "SOON"; action = "OPEN"; label = "Open";
                }
            } else {
                continue;
            }

            Integer ownerId = i.getStageOwnerUserId() != null ? i.getStageOwnerUserId() : r.getReturnOwnerUserId();
            merge(out, i.getReturnId(), TaskItemDto.builder()
                .id(i.getInstanceId()).key("return:" + i.getInstanceId())
                .type(type).category(CATEGORY_RETURNS)
                .title(r.getReturnName()).caption(caption(r, i))
                .regulator(r.getFilingRegulator()).responsiblePerson(responsibleLabel(r))
                .priority(priority).dueDate(i.getDueDate()).daysRemaining((int) days)
                .ownerName(r.getReturnOwnerName()).ownerUserId(ownerId)
                .stage(stage == null ? null : stage.db()).escalationLevel(i.getEscalationLevel())
                .linkPath("/returns/" + r.getReturnId() + "?instanceId=" + i.getInstanceId())
                .actionLabel(label).actionType(action)
                .sourceRef(Map.of("returnId", r.getReturnId(), "instanceId", i.getInstanceId()))
                .build());
        }

        return new ArrayList<>(out.values());
    }

    private void merge(Map<Long, TaskItemDto> best, Long returnId, TaskItemDto candidate) {
        TaskItemDto current = best.get(returnId);
        if (current == null || score(candidate) < score(current)) best.put(returnId, candidate);
    }

    private static int score(TaskItemDto task) {
        int rank = RANK.getOrDefault(task.getPriority(), 9);
        boolean reviewGate = task.getType() != null && task.getType().endsWith("_REVIEW");
        return rank * 10 + (reviewGate ? 0 : 1);
    }

    private List<TaskItemDto> controlsTasks() {
        LocalDate today = LocalDate.now();
        List<TaskItemDto> out = new ArrayList<>();

        List<ControlTask> tasks = controlTasks.findByStatusInAndDueDateBetweenOrderByDueDateAsc(
            List.of(WorkflowStatus.TASK_PENDING, WorkflowStatus.TASK_IN_PROGRESS, WorkflowStatus.TASK_OVERDUE),
            today.minusDays(400), today.plusDays(120));
        Set<Integer> controlIds = tasks.stream().map(ControlTask::getControlId).filter(Objects::nonNull)
            .collect(Collectors.toSet());
        Map<Integer, Control> byId = new HashMap<>();
        if (!controlIds.isEmpty()) for (Control c : controls.findAllById(controlIds)) byId.put(c.getControlId(), c);

        for (ControlTask t : tasks) {
            if (t.getDueDate() == null) continue;
            long days = ChronoUnit.DAYS.between(today, t.getDueDate());
            String type, priority, label;
            if (WorkflowStatus.TASK_OVERDUE.equals(t.getStatus()) || days < 0) {
                type = "CONTROL_TEST_OVERDUE"; priority = "OVERDUE"; label = "Record test";
            } else if (days <= CONTROL_DUE_SOON_DAYS) {
                type = "CONTROL_TEST_DUE"; priority = "SOON"; label = "Record test";
            } else {
                continue;
            }
            Control c = byId.get(t.getControlId());
            boolean noTester = c != null && c.getTesterOwnerId() == null && c.getTesterUserId() == null;
            String actionType = noTester ? "ASSIGN" : "OPEN";
            String actionLabel = noTester ? "Assign tester" : label;
            if (noTester) type = "CONTROL_TEST_ASSIGN";
            Integer ownerId = t.getAssignedToUserId() != null ? t.getAssignedToUserId()
                : (c == null ? null : c.getControlOwnerUserId());
            String ownerName = t.getAssignedToName() != null && !t.getAssignedToName().isBlank()
                ? t.getAssignedToName() : (c == null ? null : c.getControlOwnerName());
            out.add(TaskItemDto.builder()
                .id(t.getTaskId()).key("control-task:" + t.getTaskId())
                .type(type).category(CATEGORY_CONTROLS)
                .title(t.getControlName()).caption(t.getControlNumber())
                .regulator(c == null ? null : c.getActName())
                .responsiblePerson(ownerName)
                .priority(priority).dueDate(t.getDueDate()).daysRemaining((int) days)
                .ownerName(ownerName).ownerUserId(ownerId)
                .stage(t.getStatus()).escalationLevel(t.getEscalationLevel())
                .linkPath("/controls?controlId=" + t.getControlId()).actionLabel(actionLabel).actionType(actionType)
                .sourceRef(Map.of("controlId", t.getControlId(), "taskId", t.getTaskId()))
                .build());
        }

        List<ControlTestResult> pending = testResults.findByReviewStatus(WorkflowStatus.REVIEW_PENDING);
        addTestResults(out, pending, "CONTROL_TEST_AWAITING_REVIEW", "HIGH", "Review test", true);

        Map<Integer, ControlTestResult> latest = new LinkedHashMap<>();
        for (ControlTestResult r : testResults.findAllByOrderByTestDateDesc()) {
            latest.putIfAbsent(r.getControlId(), r);
        }
        List<ControlTestResult> failed = latest.values().stream()
            .filter(r -> WorkflowStatus.TEST_FAILED.equals(r.getResult()) || WorkflowStatus.TEST_PARTIAL.equals(r.getResult()))
            .filter(r -> r.getControlId() != null)
            .filter(r -> latest.get(r.getControlId()) == r)
            .toList();
        addTestResults(out, failed, "CONTROL_TEST_FAILED", "HIGH", "Review control", false);

        return out;
    }

    private void addTestResults(List<TaskItemDto> out, List<ControlTestResult> results, String type,
                                String priority, String label, boolean awaiting) {
        if (results.isEmpty()) return;
        Set<Integer> ids = results.stream().map(ControlTestResult::getControlId).filter(Objects::nonNull)
            .collect(Collectors.toSet());
        Map<Integer, Control> byId = new HashMap<>();
        if (!ids.isEmpty()) for (Control c : controls.findAllById(ids)) byId.put(c.getControlId(), c);
        Set<String> seen = new HashSet<>();
        for (ControlTestResult r : results) {
            if (r.getControlId() == null) continue;
            String key = type + ":" + r.getControlId();
            if (!seen.add(key)) continue;
            Control c = byId.get(r.getControlId());
            String ownerName = c == null ? null : c.getControlOwnerName();
            out.add(TaskItemDto.builder()
                .id(r.getTestId()).key(key)
                .type(type).category(CATEGORY_CONTROLS)
                .title(c != null ? c.getName() : ("Control " + r.getControlId()))
                .caption(c != null ? c.getControlNumber() : null)
                .regulator(c == null ? null : c.getActName())
                .responsiblePerson(ownerName)
                .priority(priority)
                .dueDate(awaiting ? null : r.getTestDate()).daysRemaining(null)
                .ownerName(ownerName).ownerUserId(c == null ? null : c.getControlOwnerUserId())
                .stage(r.getResult())
                .linkPath("/controls?controlId=" + r.getControlId()).actionLabel(label).actionType("OPEN")
                .sourceRef(Map.of("controlId", r.getControlId(), "testId", r.getTestId()))
                .build());
        }
    }

    private List<TaskItemDto> findingsTasks() {
        LocalDate today = LocalDate.now();
        List<Finding> open = findings.findByStatusNotOrderByCreatedAtDesc(WorkflowStatus.FINDING_CLOSED);
        if (open.isEmpty()) return List.of();
        Set<Integer> controlIds = open.stream().map(Finding::getLinkedControlId).filter(Objects::nonNull)
            .collect(Collectors.toSet());
        Map<Integer, Control> byControl = new HashMap<>();
        if (!controlIds.isEmpty()) for (Control c : controls.findAllById(controlIds)) byControl.put(c.getControlId(), c);

        List<TaskItemDto> out = new ArrayList<>();
        for (Finding f : open) {
            LocalDate dl = f.getRemediationDeadline();
            long days = dl == null ? Long.MAX_VALUE : ChronoUnit.DAYS.between(today, dl);
            boolean openish = WorkflowStatus.FINDING_OPEN.equals(f.getStatus())
                || WorkflowStatus.FINDING_IN_REMEDIATION.equals(f.getStatus());
            String type, priority, label;
            if (openish && dl != null && dl.isBefore(today)) {
                type = "FINDING_OVERDUE"; priority = "OVERDUE"; label = "Open";
            } else if (WorkflowStatus.FINDING_REMEDIATED.equals(f.getStatus())) {
                type = "FINDING_AWAITING_REVIEW"; priority = "HIGH"; label = "Review";
            } else if (WorkflowStatus.FINDING_TYPE_GAP.equals(f.getFindingType()) && f.getLinkedControlId() == null) {
                type = "FINDING_GAP_UNRESOLVED"; priority = "HIGH"; label = "Resolve gap";
            } else if (WorkflowStatus.FINDING_OPEN.equals(f.getStatus()) && f.getAssignedToUserId() == null) {
                type = "FINDING_UNASSIGNED"; priority = "MEDIUM"; label = "Assign";
            } else if (openish && dl != null && days <= FINDING_DUE_SOON_DAYS) {
                type = "FINDING_DUE_SOON"; priority = "SOON"; label = "Open";
            } else {
                continue;
            }
            Control c = f.getLinkedControlId() == null ? null : byControl.get(f.getLinkedControlId());
            out.add(TaskItemDto.builder()
                .id(f.getFindingId()).key("finding:" + f.getFindingId())
                .type(type).category(CATEGORY_FINDINGS)
                .title(f.getDescription() != null ? f.getDescription() : displayId(f))
                .caption(displayId(f))
                .regulator(c == null ? null : c.getActName())
                .responsiblePerson(f.getAssignedToName())
                .priority(priority).dueDate(dl).daysRemaining(dl == null ? null : (int) days)
                .ownerName(f.getAssignedToName())
                .ownerUserId("FINDING_AWAITING_REVIEW".equals(type) ? null : f.getAssignedToUserId())
                .stage(f.getStatus()).severity(f.getSeverity())
                .linkPath("/findings?findingId=" + f.getFindingId()).actionLabel(label)
                .actionType("FINDING_UNASSIGNED".equals(type) ? "ASSIGN" : "OPEN")
                .sourceRef(Map.of("findingId", f.getFindingId()))
                .build());
        }
        return out;
    }

    private List<TaskItemDto> obligationsTasks() {
        List<ObligationClassification> applicable = classifications.findByApplicability("applicable");
        List<ObligationClassification> gaps = applicable.stream()
            .filter(c -> c.getLinkedControlIds() == null || c.getLinkedControlIds().isEmpty())
            .filter(c -> c.getObligationId() != null)
            .toList();
        if (gaps.isEmpty()) return List.of();
        Set<Long> ids = gaps.stream().map(ObligationClassification::getObligationId).collect(Collectors.toSet());
        Map<Long, Obligation> byId = new HashMap<>();
        for (Obligation o : obligations.findAllById(ids)) byId.put(o.getObligationId(), o);

        List<TaskItemDto> out = new ArrayList<>();
        for (ObligationClassification c : gaps) {
            Obligation o = byId.get(c.getObligationId());
            if (o == null) continue;
            String risk = c.getTenantRiskRating() != null ? c.getTenantRiskRating() : c.getInherentRiskRating();
            boolean high = WorkflowStatus.RISK_CRITICAL.equalsIgnoreCase(risk) || WorkflowStatus.RISK_HIGH.equalsIgnoreCase(risk);
            out.add(TaskItemDto.builder()
                .id(-o.getObligationId()).key("obligation:" + o.getObligationId())
                .type("OBLIGATION_NO_CONTROL").category(CATEGORY_OBLIGATIONS)
                .title(o.getTitle() != null && !o.getTitle().isBlank() ? o.getTitle() : o.getName())
                .caption(o.getSectionReference())
                .regulator(o.getActName())
                .responsiblePerson(c.getAssignedOwnerName())
                .priority(high ? "HIGH" : "MEDIUM").dueDate(null).daysRemaining(null)
                .ownerName(c.getAssignedOwnerName()).ownerUserId(c.getAssignedOwnerUserId())
                .stage(risk)
                .linkPath("/obligations?noControl=true").actionLabel("Link control").actionType("OPEN")
                .sourceRef(Map.of("obligationId", o.getObligationId()))
                .build());
        }
        return out;
    }

    private int leadDays(RegulatoryReturn r) {
        if (r.getFilingDeadlineOffsetDays() != null && r.getFilingDeadlineOffsetDays() > 0) {
            return r.getFilingDeadlineOffsetDays();
        }
        EscalationPolicy pol = null;
        if (r.getEscalationPolicyId() != null) pol = policies.findById(r.getEscalationPolicyId()).orElse(null);
        if (pol == null) pol = policyService.defaultPolicy(EscalationConstants.SUBJECT_RETURN, r.getFrequencyType()).orElse(null);
        if (pol == null || pol.getReminderStartValue() == null) return 30;
        return EscalationConstants.UNIT_HOURS.equalsIgnoreCase(
                pol.getReminderStartUnit() == null ? "" : pol.getReminderStartUnit())
            ? (int) Math.ceil(pol.getReminderStartValue() / 24.0) : pol.getReminderStartValue();
    }

    private static String responsibleLabel(RegulatoryReturn r) {
        if (r.getResponsiblePersons() != null && !r.getResponsiblePersons().isEmpty())
            return String.join(", ", r.getResponsiblePersons());
        return r.getResponsiblePerson();
    }

    private static String displayId(Finding f) {
        return f.getExternalReference() != null && !f.getExternalReference().isBlank()
            ? f.getExternalReference() : String.format("FIND-%03d", f.getFindingId());
    }

    private static String caption(RegulatoryReturn r, ReturnFilingInstance i) {
        StringBuilder sb = new StringBuilder();
        if (r.getFilingRegulator() != null && !r.getFilingRegulator().isBlank()) sb.append(r.getFilingRegulator());
        if (i.getPeriod() != null) sb.append(sb.length() > 0 ? " · " : "").append(i.getPeriod());
        if (r.getResponsiblePerson() != null && !r.getResponsiblePerson().isBlank())
            sb.append(sb.length() > 0 ? " · " : "").append("Resp: ").append(r.getResponsiblePerson());
        return sb.toString();
    }

    private static boolean matches(TaskItemDto t, String q) {
        if (q == null || q.isBlank()) return true;
        String s = q.toLowerCase(Locale.ROOT);
        return contains(t.getTitle(), s) || contains(t.getCaption(), s) || contains(t.getOwnerName(), s)
            || contains(t.getResponsiblePerson(), s) || contains(t.getRegulator(), s);
    }

    private static boolean contains(String v, String s) {
        return v != null && v.toLowerCase(Locale.ROOT).contains(s);
    }
}
