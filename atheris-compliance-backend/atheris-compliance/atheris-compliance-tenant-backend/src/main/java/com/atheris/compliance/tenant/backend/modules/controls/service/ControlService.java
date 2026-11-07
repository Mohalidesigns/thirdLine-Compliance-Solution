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
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyDto;
import com.atheris.compliance.tenant.backend.modules.escalation.dto.EscalationPolicyRequest;
import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationPolicy;
import com.atheris.compliance.tenant.backend.modules.escalation.service.EscalationPolicyService;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.org.entity.Owner;
import com.atheris.compliance.tenant.backend.modules.org.repository.OwnerRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
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
    private final FindingRepository findingRepo;
    private final AuditService audit;
    private final ControlTestService testService;
    private final EscalationPolicyService escalationPolicyService;

    public Page<ControlRegisterItem> getRegisterList(
            String theme, String residualRisk, Integer ownerUserId, Integer ownerId, String status, String q, Integer actId, String actName, Integer obligationId, Pageable p) {
        var spec = ControlSpecification.withFilters(theme, residualRisk, ownerUserId, ownerId, status, q, actId, actName, obligationId);
        Page<Control> page = repo.findAll(spec, p);
        List<Integer> ids = page.getContent().stream().map(Control::getControlId).toList();
        Map<Integer, ControlTask> latestTasks = getLatestPendingTasks(ids);
        Map<Integer, ControlTestResult> lastTests = getLastTests(ids);
        Map<Integer, Long> openFindings = getOpenFindingCounts(ids);
        List<ControlRegisterItem> items = page.getContent().stream()
            .map(c -> toRegisterItem(c, latestTasks.get(c.getControlId()),
                lastTests.get(c.getControlId()), openFindings.getOrDefault(c.getControlId(), 0L)))
            .toList();
        return new PageImpl<>(items, p, page.getTotalElements());
    }

    public ControlStatsDto getStats() {
        long total = repo.count();
        long active = repo.countByStatus("Active");
        long highRisk = repo.countByResidualRisk("High");
        long testsDue = ControlTaskRules.testsDue(taskRepo.findAll(), LocalDate.now());
        List<String> themes = repo.findDistinctThemes();
        List<String> owners = repo.findDistinctOwners();
        List<String> acts = repo.findDistinctActNames();

        List<Control> all = repo.findAll();
        long failingControls = getLastTests(all.stream().map(Control::getControlId).toList())
            .values().stream()
            .filter(t -> WorkflowStatus.TEST_FAILED.equals(t.getResult()) || WorkflowStatus.TEST_PARTIAL.equals(t.getResult()))
            .count();
        List<String> openStatuses = List.of(WorkflowStatus.FINDING_OPEN, WorkflowStatus.FINDING_IN_REMEDIATION, WorkflowStatus.FINDING_REMEDIATED);
        long openFindings = findingRepo.findAll().stream()
            .filter(f -> openStatuses.contains(f.getStatus()))
            .count();

        Map<String, Long> byRiskLevel = all.stream()
            .map(c -> c.getResidualRiskRating() != null ? c.getResidualRiskRating() : c.getResidualRisk())
            .filter(v -> v != null && !v.isBlank())
            .collect(Collectors.groupingBy(v -> v, TreeMap::new, Collectors.counting()));
        Map<String, Long> byStatus = all.stream()
            .map(Control::getStatus).filter(v -> v != null && !v.isBlank())
            .collect(Collectors.groupingBy(v -> v, TreeMap::new, Collectors.counting()));
        List<String> riskLevels = new ArrayList<>(byRiskLevel.keySet());
        List<String> statuses = new ArrayList<>(byStatus.keySet());

        Map<String, Long> byTheme = all.stream()
            .map(Control::getTheme).filter(v -> v != null && !v.isBlank())
            .collect(Collectors.groupingBy(v -> v, TreeMap::new, Collectors.counting()));
        Map<String, Long> findingsBySeverity = findingRepo.findAll().stream()
            .filter(f -> openStatuses.contains(f.getStatus()))
            .map(Finding::getSeverity).filter(v -> v != null && !v.isBlank())
            .collect(Collectors.groupingBy(v -> v, TreeMap::new, Collectors.counting()));

        return ControlStatsDto.builder()
            .total(total)
            .active(active)
            .highRisk(highRisk)
            .testsDue(testsDue)
            .failingControls(failingControls)
            .openFindings(openFindings)
            .themes(themes)
            .owners(owners)
            .acts(acts)
            .byTheme(byTheme)
            .findingsBySeverity(findingsBySeverity)
            .totalControls(total)
            .byRiskLevel(byRiskLevel)
            .byStatus(byStatus)
            .riskLevels(riskLevels)
            .statuses(statuses)
            .build();
    }

    private Map<Integer, ControlTask> getLatestPendingTasks(List<Integer> ids) {
        List<ControlTask> tasks = taskRepo.findByControlIdInAndStatus(ids, WorkflowStatus.TASK_PENDING);
        return tasks.stream().collect(Collectors.toMap(
            ControlTask::getControlId, t -> t, (a, b) -> a.getDueDate().isBefore(b.getDueDate()) ? a : b));
    }

    /** One query per page: keep only the latest test result per control. */
    private Map<Integer, ControlTestResult> getLastTests(List<Integer> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Integer, ControlTestResult> latest = new HashMap<>();
        for (ControlTestResult t : testRepo.findByControlIdInOrderByTestDateDesc(ids)) {
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

    private ControlRegisterItem toRegisterItem(Control c, ControlTask nextTask,
            ControlTestResult lastTest, long openFindings) {
        return ControlRegisterItem.builder()
            .controlId(c.getControlId())
            .controlNumber(c.getControlNumber())
            .name(c.getName())
            .controlSummary(c.getName())
            .theme(c.getTheme())
            .controlOwnerName(c.getControlOwnerName())
            .testerOwnerId(c.getTesterOwnerId())
            .testerUserId(c.getTesterUserId())
            .testerName(c.getTesterName())
            .escalationPolicyId(c.getEscalationPolicyId())
            .ownerName(c.getOwnerName())
            .controlType(c.getControlType())
            .residualRisk(c.getResidualRisk())
            .residualLikelihood(c.getResidualLikelihood())
            .residualImpact(c.getResidualImpact())
            .residualRiskRating(c.getResidualRiskRating())
            .riskLevel(c.getResidualRiskRating() != null ? c.getResidualRiskRating() : c.getResidualRisk())
            .status(c.getStatus())
            .nextTestDueDate(nextTask != null ? nextTask.getDueDate() : null)
            .lastTestResult(lastTest != null ? lastTest.getResult() : null)
            .lastTestDate(lastTest != null ? lastTest.getTestDate() : null)
            .lastTestReviewStatus(lastTest != null ? lastTest.getReviewStatus() : null)
            .openFindings(openFindings)
            .complianceArea(c.getComplianceArea())
            .regulatoryRequirement(c.getRegulatoryRequirement())
            .frequency(c.getTestFrequency())
            .dueDate(c.getDueDate())
            .actId(c.getActId())
            .actName(c.getActName())
            .build();
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
                .failureDetails(t.getFailureDetails())
                .failureSeverity(t.getFailureSeverity())
                .evidenceUrl(t.getEvidenceUrl())
                .remediationRequired(t.getRemediationRequired())
                .reviewStatus(t.getReviewStatus())
                .createdAt(t.getCreatedAt())
                .build())
            .toList();

        LocalDate nextTest = null;
        ControlTask task = taskRepo.findTopByControlIdAndStatusOrderByDueDateAsc(id, WorkflowStatus.TASK_PENDING);
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

        return ControlDetailResponse.builder()
            .controlId(c.getControlId())
            .controlNumber(c.getControlNumber())
            .name(c.getName())
            .description(c.getDescription())
            .theme(c.getTheme())
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
            .testFrequency(c.getTestFrequency())
            .testFrequencyDays(c.getTestFrequencyDays())
            .firstDueDate(c.getFirstDueDate())
            .linkedObligations(obligations)
            .inherentRisk(c.getInherentRisk())
            .residualRisk(c.getResidualRisk())
            .residualLikelihood(c.getResidualLikelihood())
            .residualImpact(c.getResidualImpact())
            .residualRiskRating(c.getResidualRiskRating())
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
            .residualRiskReason(residualRiskReason(c, tests, findings))
            .build();
    }

    public ControlDto findById(Integer id) {
        return toDto(repo.findById(id).orElseThrow(() -> ApiException.notFound("Control not found: " + id)));
    }

    private static String residualRiskReason(Control c,
            List<ControlDetailResponse.TestResultItem> tests,
            List<ControlDetailResponse.FindingItem> findings) {
        String inherent = c.getInherentRisk() != null ? c.getInherentRisk() : "unrated";
        if (tests.isEmpty()) {
            return "No test recorded yet — residual risk defaults to inherent risk (" + inherent + ").";
        }
        ControlDetailResponse.TestResultItem last = tests.get(0);
        String when = last.getTestDate() != null ? " on " + last.getTestDate() : "";
        String closedFinding = findings.stream()
            .filter(f -> WorkflowStatus.FINDING_CLOSED.equals(f.getStatus()))
            .map(ControlDetailResponse.FindingItem::getDisplayId)
            .findFirst().orElse(null);
        return switch (last.getResult() == null ? "" : last.getResult()) {
            case WorkflowStatus.TEST_PASSED -> "Latest test passed" + when + " — residual risk lowered to Low.";
            case WorkflowStatus.TEST_PARTIAL -> "Latest test partially passed" + when
                + " — residual risk set to Medium (capped at inherent " + inherent + ").";
            case WorkflowStatus.TEST_FAILED -> {
                String base = "Latest test failed" + when
                    + " — control ineffective, residual risk restored to inherent risk (" + inherent + ").";
                yield closedFinding != null
                    ? "Latest test failed" + when + ", but " + closedFinding
                        + " was remediated and closed — residual risk restored to Low."
                    : base;
            }
            default -> "Residual risk carried from the last test" + when + ".";
        };
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
            .theme(req.getTheme())
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
            .inherentRisk(req.getInherentRisk())
            .residualRisk(req.getInherentRisk())
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
        if (req.getFirstDueDate() != null) {
            c.setFirstDueDate(req.getFirstDueDate());
        }
        if (req.getTestFrequencyDays() != null) {
            c.setTestFrequencyDays(req.getTestFrequencyDays());
        } else if (req.getTestFrequency() != null) {
            Integer derived = ControlSchedule.daysForFrequency(req.getTestFrequency());
            if (derived != null) c.setTestFrequencyDays(derived);
        }
        if (req.getInherentRisk() != null) {
            c.setInherentRisk(req.getInherentRisk());
            if (c.getResidualRisk() == null) {
                c.setResidualRisk(req.getInherentRisk());
            }
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

    private String resolveOwnerName(Integer ownerId) {
        if (ownerId == null) {
            return null;
        }
        return ownerRepo.findById(ownerId)
            .orElseThrow(() -> new EntityNotFoundException("Owner not found: " + ownerId))
            .getFullName();
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
        return repo.findByTheme(theme).stream().map(this::toDto).toList();
    }

    public List<ControlDto> findByOwner(Integer ownerId) {
        return repo.findByControlOwnerId(ownerId).stream().map(this::toDto).toList();
    }

    public List<ControlDto> findHighRisk() {
        return repo.findByResidualRisk("High").stream().map(this::toDto).toList();
    }

    private ControlDto toDto(Control c) {
        return ControlDto.builder()
            .controlId(c.getControlId())
            .controlNumber(c.getControlNumber())
            .name(c.getName())
            .description(c.getDescription())
            .theme(c.getTheme())
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
            .inherentRisk(c.getInherentRisk())
            .residualRisk(c.getResidualRisk())
            .status(c.getStatus())
            .createdAt(c.getCreatedAt())
            .updatedAt(c.getUpdatedAt())
            .build();
    }
}