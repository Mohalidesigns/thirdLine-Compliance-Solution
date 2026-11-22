package com.atheris.compliance.tenant.backend.modules.controls.service;

import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.atheris.compliance.tenant.backend.shared.util.ControlSchedule;
import com.atheris.compliance.tenant.backend.shared.util.EscalationConstants;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.dto.*;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.*;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationLevelRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationInstanceDto;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyDto;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationPolicy;
import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class ControlService {

    private final ControlRepository repo;
    private final ControlTestResultRepository testRepo;
    private final ControlTaskRepository taskRepo;
    private final ObligationRepository obligationRepo;
    private final OwnerRepository ownerRepo;
    private final DepartmentRepository departmentRepo;
    private final FindingRepository findingRepo;
    private final AuditService audit;
    private final ControlTestService testService;
    private final EscalationPolicyService escalationPolicyService;
    private final ControlThemeService themeService;

    public Page<ControlRegisterItem> getRegisterList(
            String theme, Integer ownerUserId, Integer ownerId, String status, String q, Integer actId, String actName, Integer obligationId, String effectiveness,
            Integer departmentId, Integer teamId, LocalDate dueFrom, LocalDate dueTo, Pageable p) {
        Integer themeId = themeService.require(theme);
        var spec = ControlSpecification.withFilters(themeId, ownerUserId, ownerId, status, q, actId, actName, obligationId, departmentId, teamId);
        boolean hasEffectiveness = effectiveness != null && !effectiveness.isBlank();
        if (!hasEffectiveness && dueFrom == null && dueTo == null) {
            Page<Control> page = repo.findAll(spec, safeSort(p));
            return new PageImpl<>(buildRegisterItems(page.getContent()), p, page.getTotalElements());
        }
        List<Control> all = repo.findAll(spec, safeSort(Pageable.unpaged(p.getSort()))).getContent();
        List<ControlRegisterItem> filtered = buildRegisterItems(all).stream()
            .filter(i -> !hasEffectiveness || effectiveness.equalsIgnoreCase(i.getEffectivenessState()))
            .filter(i -> withinDueRange(i.getNextTestDueDate(), dueFrom, dueTo))
            .toList();
        int from = (int) Math.min((long) p.getPageNumber() * p.getPageSize(), filtered.size());
        int to = Math.min(from + p.getPageSize(), filtered.size());
        return new PageImpl<>(filtered.subList(from, to), p, filtered.size());
    }

    private static boolean withinDueRange(LocalDate due, LocalDate from, LocalDate to) {
        if (from == null && to == null) return true;
        if (due == null) return false;
        if (from != null && due.isBefore(from)) return false;
        if (to != null && due.isAfter(to)) return false;
        return true;
    }

    private List<ControlRegisterItem> buildRegisterItems(List<Control> controls) {
        if (controls.isEmpty()) return List.of();
        List<Integer> ids = controls.stream().map(Control::getControlId).toList();
        Map<Integer, ControlTask> latestTasks = getLatestPendingTasks(ids);
        Map<Integer, ControlTestResult> lastTests = getLastTests(ids);
        Map<Integer, Long> openFindings = getOpenFindingCounts(ids);
        Map<Integer, String> themeNames = themeService.namesById(controls.stream()
            .map(Control::getControlThemeId).filter(Objects::nonNull).collect(Collectors.toSet()));
        return controls.stream()
            .map(c -> toRegisterItem(c, latestTasks.get(c.getControlId()),
                lastTests.get(c.getControlId()), openFindings.getOrDefault(c.getControlId(), 0L), themeNames))
            .toList();
    }

    private static Pageable safeSort(Pageable p) {
        List<Sort.Order> orders = p.getSort().stream()
            .filter(o -> !"theme".equals(o.getProperty()))
            .toList();
        if (p.isUnpaged() || p.getPageSize() < 1) {
            return orders.isEmpty() ? Pageable.unpaged() : Pageable.unpaged(Sort.by(orders));
        }
        return PageRequest.of(p.getPageNumber(), p.getPageSize(), Sort.by(orders));
    }

    private ControlRegisterItem toRegisterItem(Control c, ControlTask nextTask,
            ControlTestResult lastTest, long openFindings, Map<Integer, String> themeNames) {
        String latestResult = lastTest != null ? lastTest.getResult() : null;
        String state = ControlEffectiveness.of(latestResult, openFindings);
        return ControlRegisterItem.builder()
            .controlId(c.getControlId())
            .controlNumber(c.getControlNumber())
            .name(c.getName())
            .controlSummary(c.getName())
            .theme(c.getControlThemeId() == null ? null : themeNames.get(c.getControlThemeId()))
            .controlOwnerName(c.getControlOwnerName())
            .testerOwnerId(c.getTesterOwnerId())
            .testerUserId(c.getTesterUserId())
            .testerName(c.getTesterName())
            .escalationPolicyId(c.getEscalationPolicyId())
            .ownerName(c.getOwnerName())
            .controlType(c.getControlType())
            .status(c.getStatus())
            .nextTestDueDate(nextTask != null ? nextTask.getDueDate() : null)
            .lastTestResult(latestResult)
            .lastTestDate(lastTest != null ? lastTest.getTestDate() : null)
            .lastTestReviewStatus(lastTest != null ? lastTest.getReviewStatus() : null)
            .openFindings(openFindings)
            .effectivenessState(state)
            .effectivenessReason(ControlEffectiveness.reason(latestResult,
                lastTest != null ? lastTest.getTestDate() : null, openFindings))
            .complianceArea(c.getComplianceArea())
            .regulatoryRequirement(c.getRegulatoryRequirement())
            .frequency(c.getTestFrequency())
            .dueDate(c.getDueDate())
            .actId(c.getActId())
            .actName(c.getActName())
            .build();
    }

    public ControlStatsDto getStats() {
        long total = repo.count();
        long active = repo.countByStatus("Active");
        long testsDue = ControlTaskRules.testsDue(taskRepo.findAll(), LocalDate.now());
        List<String> themes = themeService.list(true).stream().map(t -> t.getName()).toList();
        List<String> owners = repo.findDistinctOwners();
        List<String> acts = repo.findDistinctActNames();

        List<Control> all = repo.findAll();
        List<Integer> allIds = all.stream().map(Control::getControlId).toList();
        Map<Integer, ControlTestResult> latestTests = getLastTests(allIds);
        Map<Integer, Long> openFindingCounts = getOpenFindingCounts(allIds);
        long failingControls = latestTests.values().stream()
            .filter(t -> WorkflowStatus.TEST_FAILED.equals(t.getResult()) || WorkflowStatus.TEST_PARTIAL.equals(t.getResult()))
            .count();
        Map<String, Long> byEffectiveness = all.stream()
            .collect(Collectors.groupingBy(
                c -> ControlEffectiveness.of(
                    latestTests.get(c.getControlId()) != null ? latestTests.get(c.getControlId()).getResult() : null,
                    openFindingCounts.getOrDefault(c.getControlId(), 0L)),
                Collectors.counting()));
        List<String> openStatuses = List.of(WorkflowStatus.FINDING_OPEN, WorkflowStatus.FINDING_IN_REMEDIATION, WorkflowStatus.FINDING_REMEDIATED);
        long openFindings = findingRepo.findAll().stream()
            .filter(f -> openStatuses.contains(f.getStatus()))
            .count();

        Map<String, Long> byStatus = all.stream()
            .map(Control::getStatus).filter(v -> v != null && !v.isBlank())
            .collect(Collectors.groupingBy(v -> v, TreeMap::new, Collectors.counting()));
        List<String> statuses = new ArrayList<>(byStatus.keySet());

        Map<Integer, String> themeNames = themeService.namesById(all.stream()
            .map(Control::getControlThemeId).filter(Objects::nonNull).collect(Collectors.toSet()));
        Map<String, Long> byTheme = all.stream()
            .map(Control::getControlThemeId).filter(Objects::nonNull)
            .map(id -> themeNames.getOrDefault(id, "Unassigned"))
            .collect(Collectors.groupingBy(v -> v, TreeMap::new, Collectors.counting()));
        Map<String, Long> findingsBySeverity = findingRepo.findAll().stream()
            .filter(f -> openStatuses.contains(f.getStatus()))
            .map(Finding::getSeverity).filter(v -> v != null && !v.isBlank())
            .collect(Collectors.groupingBy(v -> v, TreeMap::new, Collectors.counting()));

        return ControlStatsDto.builder()
            .total(total)
            .active(active)
            .testsDue(testsDue)
            .failingControls(failingControls)
            .openFindings(openFindings)
            .effective(byEffectiveness.getOrDefault(ControlEffectiveness.EFFECTIVE, 0L))
            .partiallyEffective(byEffectiveness.getOrDefault(ControlEffectiveness.PARTIAL, 0L))
            .ineffective(byEffectiveness.getOrDefault(ControlEffectiveness.INEFFECTIVE, 0L))
            .untested(byEffectiveness.getOrDefault(ControlEffectiveness.UNTESTED, 0L))
            .themes(themes)
            .owners(owners)
            .acts(acts)
            .byTheme(byTheme)
            .findingsBySeverity(findingsBySeverity)
            .totalControls(total)
            .byStatus(byStatus)
            .statuses(statuses)
            .build();
    }

    private Map<Integer, ControlTask> getLatestPendingTasks(List<Integer> ids) {
        if (ids.isEmpty()) return Map.of();
        List<ControlTask> tasks = taskRepo.findByControlIdInAndStatusIn(ids,
            List.of(WorkflowStatus.TASK_PENDING, WorkflowStatus.TASK_IN_PROGRESS, WorkflowStatus.TASK_OVERDUE));
        return tasks.stream().filter(t -> t.getDueDate() != null).collect(Collectors.toMap(
            ControlTask::getControlId, t -> t, (a, b) -> a.getDueDate().isBefore(b.getDueDate()) ? a : b));
    }

    /** One query per page: keep only the latest test result per control. */
    private Map<Integer, ControlTestResult> getLastTests(List<Integer> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Integer, ControlTestResult> latest = new HashMap<>();
        for (ControlTestResult t : testRepo.findByControlIdInOrderByTestDateDesc(ids)) {
            if (!WorkflowStatus.REVIEW_ACCEPTED.equals(t.getReviewStatus())) continue;
            ControlTestResult current = latest.get(t.getControlId());
            if (current == null || compareTest(t, current) > 0) {
                latest.put(t.getControlId(), t);
            }
        }
        return latest;
    }

    private static int compareTest(ControlTestResult a, ControlTestResult b) {
        LocalDate da = a.getTestDate();
        LocalDate db = b.getTestDate();
        if (da != null && db != null && !da.equals(db)) {
            return da.compareTo(db);
        }
        if (da != null && db == null) {
            return 1;
        }
        if (da == null && db != null) {
            return -1;
        }
        Long ia = a.getTestId() != null ? a.getTestId() : 0L;
        Long ib = b.getTestId() != null ? b.getTestId() : 0L;
        return ia.compareTo(ib);
    }

    /** Not-yet-closed findings linked to each control, batched for the page. */
    private Map<Integer, Long> getOpenFindingCounts(List<Integer> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<String> openStatuses = List.of(WorkflowStatus.FINDING_OPEN, WorkflowStatus.FINDING_IN_REMEDIATION, WorkflowStatus.FINDING_REMEDIATED);
        return findingRepo.findByLinkedControlIdIn(ids).stream()
            .filter(f -> f.getLinkedControlId() != null && openStatuses.contains(f.getStatus()))
            .collect(Collectors.groupingBy(Finding::getLinkedControlId, Collectors.counting()));
    }

    public ControlDetailResponse getDetail(Integer id) {
        Control c = repo.findById(id).orElseThrow(() -> ApiException.notFound("Control not found: " + id));

        List<ControlDetailResponse.LinkedObligation> obligations = Collections.emptyList();
        if (c.getLinkedObligationIds() != null && !c.getLinkedObligationIds().isEmpty()) {
            List<Long> distinctIds = c.getLinkedObligationIds().stream().distinct().toList();
            // one query for all linked obligations (was one findById per id)
            Map<Long, com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation> byId =
                obligationRepo.findAllById(distinctIds).stream().collect(Collectors.toMap(
                    com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation::getObligationId, o -> o));
            obligations = distinctIds.stream()
                .map(oid -> {
                    var o = byId.get(oid);
                    if (o == null) {
                        return null;
                    }
                    return ControlDetailResponse.LinkedObligation.builder()
                        .obligationId(o.getObligationId())
                        .name(o.getName())
                        .title(o.getTitle())
                        .description(o.getDescription())
                        .instrumentTitle("Instrument " + o.getInstrumentId())
                        .build();
                })
                .filter(Objects::nonNull)
                .toList();
        }

        List<ControlDetailResponse.TestResultItem> tests = testRepo
            .findByControlIdOrderByTestDateDesc(id).stream()
            .map(t -> ControlDetailResponse.TestResultItem.builder()
                .testId(t.getTestId())
                .testDate(t.getTestDate())
                .testedByUserId(t.getTestedByUserId())
                .testedByName(t.getTestedByName())
                .result(t.getResult())
                .resultDescription(t.getResultDescription())
                .failureSeverity(t.getFailureSeverity())
                .remediationRequired(t.getRemediationRequired())
                .reviewStatus(t.getReviewStatus())
                .createdAt(t.getCreatedAt())
                .build())
            .toList();

        LocalDate nextTest = null;
        ControlTask task = taskRepo.findByControlId(id).stream()
            .filter(t -> List.of(WorkflowStatus.TASK_PENDING, WorkflowStatus.TASK_IN_PROGRESS,
                WorkflowStatus.TASK_OVERDUE).contains(t.getStatus()))
            .filter(t -> t.getDueDate() != null)
            .min(Comparator.comparing(ControlTask::getDueDate))
            .orElse(null);
        if (task != null) {
            nextTest = task.getDueDate();
        }

        List<ControlDetailResponse.FindingItem> findings = findingRepo
            .findByLinkedControlIdOrderByFindingIdDesc(id).stream()
            .map(f -> ControlDetailResponse.FindingItem.builder()
                .findingId(f.getFindingId())
                .displayId("FIND-" + String.format("%03d", f.getFindingId()))
                .severity(f.getSeverity())
                .status(f.getStatus())
                .description(f.getDescription())
                .assignedToName(f.getAssignedToName())
                .remediationDeadline(f.getRemediationDeadline())
                .build())
            .toList();

        ControlTestResult latestAccepted = testRepo.findByControlIdOrderByTestDateDesc(id).stream()
            .filter(t -> WorkflowStatus.REVIEW_ACCEPTED.equals(t.getReviewStatus()))
            .findFirst().orElse(null);
        long openFindingCount = findings.stream()
            .filter(f -> !WorkflowStatus.FINDING_CLOSED.equals(f.getStatus()))
            .count();
        String effectivenessState = ControlEffectiveness.of(
            latestAccepted != null ? latestAccepted.getResult() : null, openFindingCount);

        return ControlDetailResponse.builder()
            .controlId(c.getControlId())
            .controlNumber(c.getControlNumber())
            .name(c.getName())
            .description(c.getDescription())
            .theme(c.getControlThemeId() == null ? null
                : themeService.namesById(java.util.Set.of(c.getControlThemeId())).get(c.getControlThemeId()))
            .controlType(c.getControlType())
            .whatItDoes(c.getWhatItDoes())
            .howTested(c.getHowTested())
            .controlOwnerUserId(c.getControlOwnerUserId())
            .controlOwnerId(c.getControlOwnerId())
            .controlOwnerName(c.getControlOwnerName())
            .testerOwnerId(c.getTesterOwnerId())
            .testerUserId(c.getTesterUserId())
            .testerName(c.getTesterName())
            .ownerName(c.getOwnerName())
            .department(departmentOf(c))
            .testFrequency(c.getTestFrequency())
            .testFrequencyDays(c.getTestFrequencyDays())
            .firstDueDate(c.getFirstDueDate())
            .linkedObligations(obligations)
            .status(c.getStatus())
            .regulatoryRequirement(c.getRegulatoryRequirement())
            .complianceArea(c.getComplianceArea())
            .monitoringActivity(c.getMonitoringActivity())
            .dueDate(c.getDueDate())
            .controlEffectivenessMeasure(c.getControlEffectivenessMeasure())
            .actId(c.getActId())
            .actName(c.getActName())
            .createdByUserId(c.getCreatedByUserId())
            .createdAt(c.getCreatedAt())
            .updatedAt(c.getUpdatedAt())
            .testHistory(tests)
            .nextTestDueDate(nextTest)
            .findings(findings)
            .effectivenessState(effectivenessState)
            .effectivenessReason(ControlEffectiveness.reason(
                latestAccepted != null ? latestAccepted.getResult() : null,
                latestAccepted != null ? latestAccepted.getTestDate() : null, openFindingCount))
            .lastTestResult(latestAccepted != null ? latestAccepted.getResult() : null)
            .lastTestDate(latestAccepted != null ? latestAccepted.getTestDate() : null)
            .lastTestReviewStatus(latestAccepted != null ? latestAccepted.getReviewStatus() : null)
            .lastTestedByName(latestAccepted != null ? latestAccepted.getTestedByName() : null)
            .build();
    }

    public ControlDto findById(Integer id) {
        return toDto(repo.findById(id).orElseThrow(() -> ApiException.notFound("Control not found: " + id)));
    }

    private String departmentOf(Control c) {
        if (c == null || c.getControlOwnerId() == null) return null;
        return ownerRepo.findById(c.getControlOwnerId())
            .filter(o -> o.getDepartmentId() != null)
            .flatMap(o -> departmentRepo.findById(o.getDepartmentId()))
            .map(d -> d.getName())
            .orElse(null);
    }

    @Transactional
    public ControlDto create(CreateControlRequest req, Integer userId) {
        String controlNumber = req.getControlNumber();
        if (controlNumber == null || controlNumber.isBlank()) {
            controlNumber = nextControlNumber();
        }
        if (repo.existsByControlNumber(controlNumber)) {
            throw new IllegalArgumentException("Control number already exists");
        }
        Control c = Control.builder()
            .controlNumber(controlNumber)
            .name(req.getName())
            .description(req.getDescription())
            .controlThemeId(themeService.resolveOrCreate(req.getTheme()))
            .controlType(req.getControlType())
            .whatItDoes(req.getWhatItDoes())
            .howTested(req.getHowTested())
            .controlOwnerId(req.getControlOwnerId())
            .controlOwnerName(resolveOwnerName(req.getControlOwnerId()))
            .testerOwnerId(req.getTesterOwnerId())
            .testerUserId(resolveTesterUserId(req.getTesterOwnerId()))
            .testerName(resolveOwnerName(req.getTesterOwnerId()))
            .escalationPolicyId(req.getEscalationPolicyId())
            .testFrequency(req.getTestFrequency())
            .testFrequencyDays(req.getTestFrequencyDays() != null
                ? req.getTestFrequencyDays() : ControlSchedule.daysForFrequency(req.getTestFrequency()))
            .firstDueDate(req.getFirstDueDate())
            .linkedObligationIds(new ArrayList<>())
            .status("Active")
            .createdByUserId(userId)
            .build();
        Control saved = repo.save(c);
        audit.log(userId, "control_created", "control", saved.getControlId().longValue(),
            saved.getFirstDueDate() == null ? Map.of("control_number", saved.getControlNumber())
                : Map.of("control_number", saved.getControlNumber(),
                    "firstDueDate", saved.getFirstDueDate().toString()));
        testService.scheduleNextTest(saved);
        return toDto(saved);
    }

    @Transactional
    public ControlDto update(Integer id, CreateControlRequest req, Integer userId) {
        Control c = repo.findById(id)
            .orElseThrow(() -> ApiException.notFound("Control not found: " + id));
        if (req.getName() != null) {
            c.setName(req.getName());
        }
        if (req.getDescription() != null) {
            c.setDescription(req.getDescription());
        }
        if (req.getWhatItDoes() != null) {
            c.setWhatItDoes(req.getWhatItDoes());
        }
        if (req.getHowTested() != null) {
            c.setHowTested(req.getHowTested());
        }
        if (req.getControlOwnerId() != null) {
            c.setControlOwnerId(req.getControlOwnerId());
            c.setControlOwnerName(resolveOwnerName(req.getControlOwnerId()));
            applyControlOwnerPlacement(c, req.getControlOwnerId());
        }
        if (req.getTesterOwnerId() != null) {
            c.setTesterOwnerId(req.getTesterOwnerId());
            c.setTesterUserId(resolveTesterUserId(req.getTesterOwnerId()));
            c.setTesterName(resolveOwnerName(req.getTesterOwnerId()));
        }
        if (req.getEscalationPolicyId() != null) {
            c.setEscalationPolicyId(req.getEscalationPolicyId());
        }
        if (req.getTestFrequency() != null) {
            c.setTestFrequency(req.getTestFrequency());
        }
        if (req.getTheme() != null) {
            c.setControlThemeId(themeService.resolveOrCreate(req.getTheme()));
        }
        if (req.getFirstDueDate() != null) {
            c.setFirstDueDate(req.getFirstDueDate());
        }
        if (req.getTestFrequencyDays() != null) {
            c.setTestFrequencyDays(req.getTestFrequencyDays());
        } else if (req.getTestFrequency() != null) {
            Integer derived = ControlSchedule.daysForFrequency(req.getTestFrequency());
            if (derived != null) c.setTestFrequencyDays(derived);
        }
        audit.log(userId, "control_updated", "control", id.longValue(), Map.of());
        Control saved = repo.save(c);
        boolean hasOpenTask = taskRepo.findByControlId(id).stream()
            .anyMatch(t -> !WorkflowStatus.TASK_COMPLETED.equals(t.getStatus()));
        if (!hasOpenTask && saved.getTestFrequencyDays() != null) {
            testService.scheduleNextTest(saved);
        } else {
            testService.reassignOpenTasks(saved);
        }
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public ControlEscalationResponse resolveEscalation(Integer id) {
        Control c = repo.findById(id)
            .orElseThrow(() -> ApiException.notFound("Control not found: " + id));
        String scope = ControlSchedule.scope(c.getTestFrequency());
        EscalationInstanceDto config = escalationPolicyService.resolve(
            EscalationConstants.SUBJECT_CONTROL, null, c.getEscalationPolicyId(), scope);
        if (config == null) {
            return ControlEscalationResponse.builder().active(false).build();
        }
        EscalationPolicyDto policy = config.getSourcePolicyId() == null ? null
            : escalationPolicyService.get(config.getSourcePolicyId());
        return ControlEscalationResponse.builder()
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
            .levels(config.getLevels())
            .build();
    }

    @Transactional
    public ControlDto updateEscalation(Integer id, ControlEscalationRequest req, Integer userId) {
        Control c = repo.findById(id)
            .orElseThrow(() -> ApiException.notFound("Control not found: " + id));
        String scope = ControlSchedule.scope(c.getTestFrequency());
        EscalationPolicy def = escalationPolicyService
            .defaultPolicy(EscalationConstants.SUBJECT_CONTROL, scope)
            .or(() -> escalationPolicyService.defaultPolicy(EscalationConstants.SUBJECT_CONTROL))
            .orElse(null);
        Integer startValue = req.getReminderStartValue() != null ? req.getReminderStartValue()
            : (def == null ? null : def.getReminderStartValue());
        String startUnit = req.getReminderStartUnit() != null ? req.getReminderStartUnit()
            : (def == null || def.getReminderStartUnit() == null
                ? EscalationConstants.UNIT_DAYS : def.getReminderStartUnit());
        EscalationPolicyRequest policyReq = EscalationPolicyRequest.builder()
            .name(c.getName() + " escalation #" + c.getControlId())
            .subjectType(EscalationConstants.SUBJECT_CONTROL)
            .frequencyScope(scope).isDefault(false).isActive(true)
            .reminderStartValue(startValue).reminderStartUnit(startUnit)
            .reminderRepeatValue(req.getReminderRepeatValue()).reminderRepeatUnit(req.getReminderRepeatUnit())
            .sendLink(true).notifyOnStart(true)
            .levels(normaliseLevels(req.getLevels())).build();
        Long policyId = c.getEscalationPolicyId();
        EscalationPolicyDto dto = policyId == null
            ? escalationPolicyService.create(policyReq, userId)
            : escalationPolicyService.update(policyId, policyReq, userId);
        c.setEscalationPolicyId(dto.getPolicyId());
        audit.log(userId, "control_escalation_set", "control", id.longValue(),
            Map.of("policyId", String.valueOf(dto.getPolicyId())));
        return toDto(repo.save(c));
    }

    private static List<EscalationLevelRequest> normaliseLevels(List<EscalationLevelRequest> provided) {
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
                    .afterUnit(EscalationConstants.UNIT_HOURS.equalsIgnoreCase(
                        l.getAfterUnit() == null ? "" : l.getAfterUnit())
                        ? EscalationConstants.UNIT_HOURS : EscalationConstants.UNIT_DAYS)
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
            EscalationLevelRequest.builder().levelNo(2).afterValue(2).afterUnit(EscalationConstants.UNIT_DAYS)
                .targetType(EscalationConstants.TARGET_MANAGER).build(),
            EscalationLevelRequest.builder().levelNo(3).afterValue(5).afterUnit(EscalationConstants.UNIT_DAYS)
                .targetType(EscalationConstants.TARGET_ROLE).targetRole(AppRole.CCO).build());
    }

    @Transactional
    public ControlDto assignTester(Integer id, Integer testerOwnerId, Integer userId) {
        Control c = repo.findById(id)
            .orElseThrow(() -> ApiException.notFound("Control not found: " + id));
        c.setTesterOwnerId(testerOwnerId);
        c.setTesterUserId(resolveTesterUserId(testerOwnerId));
        c.setTesterName(resolveOwnerName(testerOwnerId));
        audit.log(userId, "control_tester_assigned", "control", id.longValue(),
            testerOwnerId == null ? Map.of("tester", "none") : Map.of("testerOwnerId", testerOwnerId));
        Control saved = repo.save(c);
        testService.reassignOpenTasks(saved);
        return toDto(saved);
    }

    private void applyControlOwnerPlacement(Control c, Integer ownerId) {
        if (ownerId == null) {
            c.setControlOwnerDepartmentId(null);
            c.setControlOwnerTeamId(null);
            return;
        }
        Owner o = ownerRepo.findById(ownerId).orElse(null);
        c.setControlOwnerDepartmentId(o != null ? o.getDepartmentId() : null);
        c.setControlOwnerTeamId(o != null ? o.getTeamId() : null);
    }

    private String resolveOwnerName(Integer ownerId) {
        if (ownerId == null) {
            return null;
        }
        Owner owner = ownerRepo.findById(ownerId)
            .orElseThrow(() -> new EntityNotFoundException("Owner not found: " + ownerId));
        if (owner.getDepartmentId() == null || owner.getTeamId() == null) {
            throw ApiException.conflict("stakeholder_not_placed",
                owner.getFullName() + " is not placed in a department and unit. Place them before assigning work.");
        }
        return owner.getFullName();
    }

    private Integer resolveTesterUserId(Integer ownerId) {
        if (ownerId == null) {
            return null;
        }
        return ownerRepo.findById(ownerId).map(Owner::getUserId).orElse(null);
    }

    private String nextControlNumber() {
        long count = repo.count();
        String candidate;
        do {
            count++;
            candidate = String.format("CTL-%04d", count);
        } while (repo.existsByControlNumber(candidate));
        return candidate;
    }

    public List<ControlDto> findAll() {
        return repo.findByStatus("Active").stream().map(this::toDto).toList();
    }

    public List<ControlDto> findByTheme(String theme) {
        Integer themeId = themeService.require(theme);
        if (themeId == null) return List.of();
        return repo.findByControlThemeId(themeId).stream().map(this::toDto).toList();
    }

    public List<ControlDto> findByOwner(Integer ownerId) {
        return repo.findByControlOwnerId(ownerId).stream().map(this::toDto).toList();
    }

    private ControlDto toDto(Control c) {
        return ControlDto.builder()
            .controlId(c.getControlId())
            .controlNumber(c.getControlNumber())
            .name(c.getName())
            .description(c.getDescription())
            .theme(c.getControlThemeId() == null ? null
                : themeService.namesById(java.util.Set.of(c.getControlThemeId())).get(c.getControlThemeId()))
            .controlType(c.getControlType())
            .whatItDoes(c.getWhatItDoes())
            .howTested(c.getHowTested())
            .controlOwnerUserId(c.getControlOwnerUserId())
            .controlOwnerId(c.getControlOwnerId())
            .controlOwnerName(c.getControlOwnerName())
            .testerOwnerId(c.getTesterOwnerId())
            .testerUserId(c.getTesterUserId())
            .testerName(c.getTesterName())
            .testFrequency(c.getTestFrequency())
            .testFrequencyDays(c.getTestFrequencyDays())
            .firstDueDate(c.getFirstDueDate())
            .linkedObligationIds(c.getLinkedObligationIds())
            .status(c.getStatus())
            .createdAt(c.getCreatedAt())
            .updatedAt(c.getUpdatedAt())
            .build();
    }
}