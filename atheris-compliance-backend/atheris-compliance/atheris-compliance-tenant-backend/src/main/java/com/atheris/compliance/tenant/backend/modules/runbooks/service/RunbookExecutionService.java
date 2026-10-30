package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.audit.entity.AuditEvent;
import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.dto.RecordTestRequest;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.service.ControlTestService;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import com.atheris.compliance.tenant.backend.modules.evidence.service.FileStorageService;
import com.atheris.compliance.tenant.backend.modules.findings.dto.FindingRaisedResponse;
import com.atheris.compliance.tenant.backend.modules.findings.dto.RaiseFindingRequest;
import com.atheris.compliance.tenant.backend.modules.findings.service.FindingService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.*;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.*;

/**
 * The runbook execution engine (spec §8.2–§8.6). Invariants enforced here, never in the UI:
 * <ul>
 *   <li>only PUBLISHED versions execute;</li>
 *   <li>a step cannot pass until every mandatory evidence requirement is satisfied;</li>
 *   <li>a dual-control step passes only when a second, re-authenticated user verifies it;</li>
 *   <li>evidence is hashed (SHA-256) server-side and immutable — no update or delete path exists;</li>
 *   <li>every state change writes an audit event.</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RunbookExecutionService {

    static final Set<String> EXECUTOR_ROLES = Set.of(AppRole.ANALYST, AppRole.CCO, AppRole.TENANT_ADMIN, AppRole.IT_OPS);
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "csv",
        "log", "json", "xml", "xlsx", "xls", "docx", "doc", "zip", "eml", "msg", "cfg", "conf", "yaml", "yml", "html", "md");
    private static final long MAX_EVIDENCE_BYTES = 25L * 1024 * 1024;

    private final RunbookRepository runbooks;
    private final RunbookVersionRepository versions;
    private final RunbookExecutionRepository executions;
    private final RunbookStepExecutionRepository stepExecs;
    private final RunbookEvidenceItemRepository evidence;
    private final RunbookExecutionEscalationRepository execEscalations;
    private final RunbookExecutionSignoffRepository signoffs;
    private final RunbookEscalationPathRepository escalationPaths;
    private final RunbookPrerequisiteRepository prerequisites;
    private final RunbookRollbackStepRepository rollbackSteps;
    private final RunbookClauseMapRepository clauseMap;
    private final RunbookTreeService tree;
    private final RunbookService runbookService;
    private final RunbookViews views;
    private final EvidenceFileRepository evidenceFiles;
    private final FileStorageService storage;
    private final FindingService findings;
    private final ControlTestService controlTests;
    private final ControlRepository controls;
    private final NotificationService notifications;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    // ── register ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<ExecutionSummaryDto> list(String q, String status, Long runbookId, Integer operatorId,
                                          Instant from, Instant to, Boolean overdue, Pageable p) {
        Page<RunbookExecution> page = executions.findAll(
            RunbookExecutionSpecification.withFilters(q, status, runbookId, operatorId, from, to, overdue), p);
        Map<Long, ExecutionSummaryDto> dto = views.executionSummaries(page.getContent()).stream()
            .collect(Collectors.toMap(ExecutionSummaryDto::getExecutionId, Function.identity()));
        return page.map(e -> dto.get(e.getExecutionId()));
    }

    @Transactional(readOnly = true)
    public ExecutionStatsDto stats() {
        Map<String, Long> byStatus = new TreeMap<>();
        executions.countByStatus().forEach(r -> byStatus.put((String) r[0], ((Number) r[1]).longValue()));
        List<RunbookExecution> active = executions.findByStatusIn(ACTIVE_EXECUTION_STATUSES);
        List<RunbookExecution> closed30 = executions.findByClosedAtAfter(Instant.now().minus(Duration.ofDays(30)));
        return ExecutionStatsDto.builder()
            .active((long) active.size())
            .overdue(active.stream().filter(RunbookViews::isOverdue).count())
            .pendingSignoff(byStatus.getOrDefault(EX_PENDING_SIGNOFF, 0L))
            .completedPass30d(closed30.stream().filter(e -> EX_COMPLETED_PASS.equals(e.getStatus())).count())
            .completedFail30d(closed30.stream().filter(e -> EX_COMPLETED_FAIL.equals(e.getStatus())).count())
            .aborted30d(closed30.stream().filter(e -> EX_ABORTED.equals(e.getStatus())).count())
            .openEscalations(openEscalationCount())
            .byStatus(byStatus).build();
    }

    // ── start ───────────────────────────────────────────────────────────────

    @Transactional
    public ExecutionDetailDto start(Long runbookId, StartExecutionRequest req, User user) {
        requireExecutor(user);
        Runbook rb = runbookService.find(runbookId);
        if (RB_DEPRECATED.equals(rb.getStatus()) || RB_ARCHIVED.equals(rb.getStatus())) {
            throw ApiException.conflict("Deprecated or archived runbooks cannot be executed");
        }
        Long versionId = req.getVersionId() != null ? req.getVersionId() : rb.getCurrentVersionId();
        if (versionId == null) throw ApiException.conflict("not_published", "The runbook has no published version to execute");
        RunbookVersion v = runbookService.findVersion(runbookId, versionId);
        if (!V_PUBLISHED.equals(v.getStatus())) {
            throw ApiException.conflict("not_published", "Only the PUBLISHED version can be executed (v" + v.getVersionNumber() + " is " + v.getStatus() + ")");
        }
        String trigger = req.getTriggerType() != null ? req.getTriggerType() : "MANUAL";
        if (!TRIGGER_TYPES.contains(trigger)) throw ApiException.badRequest("Invalid trigger type: " + trigger);
        User operator = req.getOperatorUserId() != null ? activeUser(req.getOperatorUserId()) : user;
        if (!EXECUTOR_ROLES.contains(operator.getRole())) {
            throw ApiException.badRequest("The operator must have an executing role (Analyst, CCO, Tenant Admin or IT Ops)");
        }
        Instant now = Instant.now();
        Instant due = req.getDueAt() != null ? req.getDueAt()
            : rb.getSlaMinutes() != null ? now.plus(Duration.ofMinutes(rb.getSlaMinutes())) : null;
        if (due != null && !due.isAfter(now)) throw ApiException.badRequest("The due time must be in the future");
        RunbookExecution e = createExecution(rb, v, trigger, req.getTriggerRefId(), operator, now, due, null, null);
        audit.log(user.getUserId(), "execution_started", SUBJECT_EXECUTION, e.getExecutionId(),
            Map.of("ref", e.getExecutionRef(), "runbook", rb.getRunbookCode(), "version", v.getVersionNumber(),
                "trigger", trigger, "operatorUserId", operator.getUserId()));
        if ("INCIDENT".equals(rb.getCategory()) || "INCIDENT".equals(trigger)) {
            // Incident runbook started → fan out to escalation level 1 (spec §8.6).
            escalationPaths.findByVersionIdOrderByLevelAsc(v.getVersionId()).stream()
                .filter(p -> p.getLevel() == 1).findFirst()
                .ifPresent(p -> sendEscalation(e, rb, p.getLevel(), "INCIDENT_STARTED", p.getNotifyRole(), p.getNotifyUserId(),
                    p.getNotifyChannel(), "Incident runbook " + rb.getRunbookCode() + " started (" + e.getExecutionRef() + ")"));
        }
        return detail(e);
    }

    /** Creates an execution (and one PENDING row per step). Shared by manual starts and the scheduler. */
    @Transactional
    public RunbookExecution createExecution(Runbook rb, RunbookVersion v, String trigger, Long triggerRef, User operator,
                                            Instant startedAt, Instant dueAt, Long scheduleId, LocalDate scheduledFor) {
        RunbookVersionTreeDto t = tree.load(v);
        boolean hasPrereqs = !t.getPrerequisites().isEmpty();
        String status = startedAt == null ? EX_NOT_STARTED : hasPrereqs ? EX_PREFLIGHT : EX_IN_PROGRESS;
        String ref = String.format("RBX-%d-%06d", Year.now(ZoneOffset.UTC).getValue(), executions.nextRefNumber());
        RunbookExecution e = executions.save(RunbookExecution.builder()
            .executionRef(ref).runbookId(rb.getRunbookId()).versionId(v.getVersionId())
            .triggerType(trigger).triggerRefId(triggerRef).scheduleId(scheduleId).scheduledFor(scheduledFor)
            .operatorUserId(operator.getUserId()).operatorName(operator.getFullName())
            .status(status).startedAt(startedAt).dueAt(dueAt)
            .preflightCompletedAt(startedAt != null && !hasPrereqs ? startedAt : null)
            .build());
        int order = 0;
        for (SectionDto s : t.getSections()) {
            for (StepDto st : s.getSteps()) {
                stepExecs.save(RunbookStepExecution.builder().executionId(e.getExecutionId()).stepId(st.getStepId())
                    .sortOrder(order++).status(ST_PENDING).build());
            }
        }
        e.setStepsTotal(order);
        return executions.save(e);
    }

    // ── preflight / steps ───────────────────────────────────────────────────

    @Transactional
    public ExecutionDetailDto preflight(Long execId, List<Long> acks, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        if (!EX_PREFLIGHT.equals(e.getStatus()) && !EX_NOT_STARTED.equals(e.getStatus())) {
            throw ApiException.conflict("Pre-flight is already complete (status " + e.getStatus() + ")");
        }
        List<RunbookPrerequisite> prereqs = prerequisites.findByVersionIdOrderBySortOrderAsc(e.getVersionId());
        Set<Long> valid = prereqs.stream().map(RunbookPrerequisite::getPrereqId).collect(Collectors.toSet());
        Set<Long> acked = new LinkedHashSet<>(acks != null ? acks : List.of());
        if (!valid.containsAll(acked)) throw ApiException.badRequest("Unknown prerequisite id");
        List<String> missing = prereqs.stream().filter(p -> Boolean.TRUE.equals(p.getIsMandatory()) && !acked.contains(p.getPrereqId()))
            .map(RunbookPrerequisite::getLabel).toList();
        if (!missing.isEmpty()) throw ApiException.badRequest("Confirm every mandatory prerequisite: " + String.join("; ", missing));
        Instant now = Instant.now();
        e.setPreflightAcks(new ArrayList<>(acked));
        e.setPreflightCompletedAt(now);
        if (e.getStartedAt() == null) e.setStartedAt(now);
        e.setStatus(EX_IN_PROGRESS);
        executions.save(e);
        audit.log(user.getUserId(), "execution_preflight_completed", SUBJECT_EXECUTION, execId, Map.of("prereqAcks", new ArrayList<>(acked)));
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto startStep(Long execId, Long stepExecId, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        if (EX_NOT_STARTED.equals(e.getStatus())) {
            if (!prerequisites.findByVersionIdOrderBySortOrderAsc(e.getVersionId()).isEmpty()) {
                throw ApiException.conflict("preflight_required", "Complete the pre-flight checklist first");
            }
            e.setStatus(EX_IN_PROGRESS);
            e.setStartedAt(Instant.now());
            e.setPreflightCompletedAt(Instant.now());
        }
        RunbookStepExecution s = findStep(execId, stepExecId);
        requireWorkable(e, s);
        requireStepActor(e, s, stepDefs(e.getVersionId()), user);
        if (!ST_PENDING.equals(s.getStatus())) throw ApiException.conflict("The step is already " + s.getStatus());
        List<RunbookStepExecution> all = stepExecs.findByExecutionIdOrderBySortOrderAsc(execId);
        boolean rollback = s.getRollbackId() != null;
        if (rollback) {
            all.stream().filter(x -> x.getRollbackId() != null && x.getSortOrder() < s.getSortOrder()
                    && !TERMINAL_STEP_STATUSES.contains(x.getStatus())).findFirst()
                .ifPresent(x -> { throw ApiException.conflict("Finish the earlier rollback steps first"); });
        } else {
            Map<Long, Boolean> blocking = blockingByStepId(e.getVersionId());
            all.stream().filter(x -> x.getRollbackId() == null && x.getSortOrder() < s.getSortOrder()
                    && Boolean.TRUE.equals(blocking.get(x.getStepId())) && !TERMINAL_STEP_STATUSES.contains(x.getStatus()))
                .findFirst()
                .ifPresent(x -> { throw ApiException.conflict("blocked_by_previous_step", "An earlier blocking step must be completed first"); });
        }
        s.setStatus(ST_IN_PROGRESS);
        s.setStartedAt(Instant.now());
        s.setPerformedByUserId(user.getUserId());
        stepExecs.save(s);
        executions.save(e);
        audit.log(user.getUserId(), "step_started", SUBJECT_EXECUTION, execId, Map.of("stepExecId", stepExecId));
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto pass(Long execId, Long stepExecId, PassStepRequest req, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        RunbookStepExecution s = findStep(execId, stepExecId);
        requireWorkable(e, s);
        if (!ST_IN_PROGRESS.equals(s.getStatus())) throw ApiException.conflict("Start the step before passing it");
        StepDefs defs = stepDefs(e.getVersionId());
        requireStepActor(e, s, defs, user);
        List<RunbookStepEvidenceReq> missing = missingMandatory(s, defs, evidence.findByStepExecIdOrderByCapturedAtAsc(stepExecId));
        if (!missing.isEmpty()) {
            throw ApiException.conflict("evidence_required", "Capture the mandatory evidence first: "
                + missing.stream().map(RunbookStepEvidenceReq::getLabel).collect(Collectors.joining("; ")));
        }
        s.setActualResult(RunbookTreeService.blankToNull(req.getActualResult()));
        s.setOperatorNotes(RunbookTreeService.blankToNull(req.getNotes()));
        if (s.getPerformedByUserId() == null) s.setPerformedByUserId(user.getUserId());
        RunbookStep def = s.getStepId() != null ? defs.steps.get(s.getStepId()) : null;
        if (def != null && Boolean.TRUE.equals(def.getRequiresDualControl())) {
            s.setStatus(ST_AWAITING_VERIFICATION);
            stepExecs.save(s);
            audit.log(user.getUserId(), "step_pass_requested", SUBJECT_EXECUTION, execId,
                Map.of("stepExecId", stepExecId, "stepCode", String.valueOf(def.getStepCode())));
            notifications.notifyRoleEmailed(def.getAssignedRole() != null && EXECUTOR_ROLES.contains(def.getAssignedRole())
                    ? def.getAssignedRole() : AppRole.CCO, NOTIFICATION_CATEGORY, NotificationConstants.SEVERITY_MEDIUM,
                "Dual-control verification needed on " + e.getExecutionRef() + " step " + def.getStepCode(),
                "/runbooks/executions/" + execId,
                "Verification needed: " + e.getExecutionRef() + " step " + def.getStepCode(), user.getUserId());
        } else {
            s.setStatus(ST_PASSED);
            s.setCompletedAt(Instant.now());
            stepExecs.save(s);
            audit.log(user.getUserId(), "step_passed", SUBJECT_EXECUTION, execId,
                Map.of("stepExecId", stepExecId, "stepCode", stepCode(s, defs)));
        }
        afterStepChange(e);
        return detail(e);
    }

    /** Second-person verification of a dual-control step; the verifier re-authenticates with their password. */
    @Transactional
    public ExecutionDetailDto verify(Long execId, Long stepExecId, String password, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        RunbookStepExecution s = findStep(execId, stepExecId);
        requireWorkable(e, s);
        if (!ST_AWAITING_VERIFICATION.equals(s.getStatus())) throw ApiException.conflict("The step is not awaiting verification");
        if (user.getUserId().equals(s.getPerformedByUserId())) {
            throw ApiException.conflict("same_person", "Dual control: the verifier must be a different person from the performer");
        }
        User fresh = users.findById(user.getUserId()).orElseThrow();
        if (fresh.getPasswordHash() == null) {
            throw ApiException.badRequest("reauth_unavailable", "Password re-authentication is not available for this account");
        }
        if (password == null || !passwordEncoder.matches(password, fresh.getPasswordHash())) {
            audit.log(user.getUserId(), "step_verification_failed", SUBJECT_EXECUTION, execId, Map.of("stepExecId", stepExecId));
            // 400 (not 401): a wrong re-auth password must not end the verifier's session.
            throw ApiException.badRequest("verification_failed", "The password is incorrect");
        }
        s.setVerifiedByUserId(user.getUserId());
        s.setStatus(ST_PASSED);
        s.setCompletedAt(Instant.now());
        stepExecs.save(s);
        audit.log(user.getUserId(), "step_verified", SUBJECT_EXECUTION, execId,
            Map.of("stepExecId", stepExecId, "performedBy", String.valueOf(s.getPerformedByUserId())));
        afterStepChange(e);
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto fail(Long execId, Long stepExecId, FailStepRequest req, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        RunbookStepExecution s = findStep(execId, stepExecId);
        requireWorkable(e, s);
        if (!ST_IN_PROGRESS.equals(s.getStatus()) && !ST_AWAITING_VERIFICATION.equals(s.getStatus())) {
            throw ApiException.conflict("Start the step before failing it");
        }
        if (req.getActualResult() == null || req.getActualResult().isBlank()) throw ApiException.badRequest("Describe the actual result");
        String category = req.getCategory() != null ? req.getCategory() : "DEVIATION";
        if (!FAILURE_CATEGORIES.contains(category)) throw ApiException.badRequest("Invalid failure category: " + category);
        String next = req.getNextAction() != null ? req.getNextAction() : "CONTINUE";
        if (!Set.of("CONTINUE", "PAUSE", "ROLLBACK").contains(next)) throw ApiException.badRequest("Invalid next action: " + next);

        Runbook rb = runbookService.find(e.getRunbookId());
        StepDefs defs = stepDefs(e.getVersionId());
        requireStepActor(e, s, defs, user);
        RunbookStep def = s.getStepId() != null ? defs.steps.get(s.getStepId()) : null;
        String code = stepCode(s, defs);
        s.setStatus(ST_FAILED);
        s.setActualResult(req.getActualResult().trim());
        s.setOperatorNotes(RunbookTreeService.blankToNull(req.getNotes()));
        s.setFailureCategory(category);
        s.setCompletedAt(Instant.now());
        if (s.getPerformedByUserId() == null) s.setPerformedByUserId(user.getUserId());
        stepExecs.save(s);
        audit.log(user.getUserId(), "step_failed", SUBJECT_EXECUTION, execId,
            Map.of("stepExecId", stepExecId, "stepCode", code, "category", category, "nextAction", next));

        if (Boolean.TRUE.equals(req.getRaiseFinding())) {
            e.setFindingId(raiseFinding(e, rb, code, req.getActualResult().trim(), user));
        }
        boolean blocking = def != null && Boolean.TRUE.equals(def.getIsBlocking());
        int level = req.getEscalateLevel() != null ? req.getEscalateLevel() : 0;
        String msg = rb.getRunbookCode() + " " + e.getExecutionRef() + ": step " + code + " failed — " + req.getActualResult().trim();
        if (blocking || level > 0) {
            escalateByTrigger(e, rb, TRIG_STEP_FAILED, level, msg);
        }
        if (blocking && s.getRollbackId() == null) {
            // A failed blocking step halts the run until someone resumes, rolls back or aborts (spec §8.2).
            e.setStatus(EX_ESCALATED);
        }
        executions.save(e);
        if ("ROLLBACK".equals(next) && s.getRollbackId() == null) {
            return rollback(execId, "Step " + code + " failed: " + req.getActualResult().trim(), user);
        }
        if ("PAUSE".equals(next) && !EX_ESCALATED.equals(e.getStatus())) {
            e.setStatusBeforePause(e.getStatus());
            e.setStatus(EX_PAUSED);
            executions.save(e);
        }
        afterStepChange(e);
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto skip(Long execId, Long stepExecId, SkipStepRequest req, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        RunbookStepExecution s = findStep(execId, stepExecId);
        requireWorkable(e, s);
        if (TERMINAL_STEP_STATUSES.contains(s.getStatus()) || ST_AWAITING_VERIFICATION.equals(s.getStatus())) {
            throw ApiException.conflict("The step can no longer be skipped");
        }
        StepDefs defs = stepDefs(e.getVersionId());
        requireStepActor(e, s, defs, user);
        RunbookStep def = s.getStepId() != null ? defs.steps.get(s.getStepId()) : null;
        if (def != null && !Boolean.TRUE.equals(def.getAllowSkip())) throw ApiException.conflict("This step does not allow skipping");
        if (req.getReason() == null || req.getReason().trim().length() < 10) {
            throw ApiException.badRequest("Give a reason of at least 10 characters");
        }
        s.setStatus(Boolean.TRUE.equals(req.getNotApplicable()) ? ST_NA : ST_SKIPPED);
        s.setSkipReason(req.getReason().trim());
        s.setPerformedByUserId(user.getUserId());
        s.setCompletedAt(Instant.now());
        stepExecs.save(s);
        audit.log(user.getUserId(), "step_skipped", SUBJECT_EXECUTION, execId,
            Map.of("stepExecId", stepExecId, "stepCode", stepCode(s, defs), "status", s.getStatus(), "reason", s.getSkipReason()));
        afterStepChange(e);
        return detail(e);
    }

    // ── evidence ────────────────────────────────────────────────────────────

    @Transactional
    public ExecutionDetailDto captureEvidence(Long execId, Long stepExecId, MultipartFile file, Long reqId, String evidenceType,
                                              String externalRef, String attestationText, String pastedOutput, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        RunbookStepExecution s = findStep(execId, stepExecId);
        if (!WORKABLE_EXECUTION_STATUSES.contains(e.getStatus()) && !EX_PAUSED.equals(e.getStatus())) {
            throw ApiException.conflict("Evidence can only be captured while the execution is running (status " + e.getStatus() + ")");
        }
        if (!Set.of(ST_IN_PROGRESS, ST_AWAITING_VERIFICATION, ST_FAILED).contains(s.getStatus())) {
            throw ApiException.conflict("Start the step before capturing evidence");
        }
        int payloads = (file != null && !file.isEmpty() ? 1 : 0) + (notBlank(pastedOutput) ? 1 : 0)
            + (notBlank(externalRef) ? 1 : 0) + (notBlank(attestationText) ? 1 : 0);
        if (payloads != 1) throw ApiException.badRequest("Provide exactly one of: a file, pasted output, an external reference or an attestation");

        StepDefs defs = stepDefs(e.getVersionId());
        RunbookStepEvidenceReq req = null;
        if (reqId != null) {
            req = defs.reqs.getOrDefault(s.getStepId(), List.of()).stream().filter(r -> r.getReqId().equals(reqId)).findFirst()
                .orElseThrow(() -> ApiException.badRequest("The evidence requirement does not belong to this step"));
        }
        requireStepActor(e, s, defs, user);
        String type = evidenceType != null ? evidenceType : req != null ? req.getEvidenceType()
            : notBlank(attestationText) ? "ATTESTATION" : notBlank(externalRef) ? "TICKET_REF"
            : notBlank(pastedOutput) ? "QUERY_OUTPUT" : "DOCUMENT";
        if (!EVIDENCE_TYPES.contains(type)) throw ApiException.badRequest("Invalid evidence type: " + type);
        if (req != null) {
            boolean hasFile = file != null && !file.isEmpty();
            String fname = hasFile && file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
            String fext = fname.contains(".") ? fname.substring(fname.lastIndexOf('.') + 1).toLowerCase() : "";
            String mismatch = evidenceMismatch(req.getEvidenceType(), req.getAcceptedMime(), fext,
                hasFile ? file.getContentType() : null, hasFile, notBlank(pastedOutput), notBlank(externalRef), notBlank(attestationText));
            if (mismatch != null) throw ApiException.badRequest("evidence_type_mismatch", mismatch + " (" + req.getLabel() + ")");
        }

        Long fileId = null;
        String sha;
        String code = stepCode(s, defs);
        try {
            if (file != null && !file.isEmpty()) {
                String name = file.getOriginalFilename() != null ? file.getOriginalFilename() : "evidence.bin";
                String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
                if (!ALLOWED_EXTENSIONS.contains(ext)) throw ApiException.badRequest("file_type_not_allowed", "Files of type ." + ext + " are not accepted as evidence");
                if (file.getSize() > MAX_EVIDENCE_BYTES) throw ApiException.badRequest("Evidence files are limited to 25 MB");
                byte[] bytes = file.getBytes();
                sha = RunbookTreeService.sha256(bytes);
                fileId = storeFile(name, file.getContentType(), bytes, stepExecId, e, code, user);
            } else if (notBlank(pastedOutput)) {
                byte[] bytes = pastedOutput.getBytes(StandardCharsets.UTF_8);
                sha = RunbookTreeService.sha256(bytes);
                fileId = storeFile(e.getExecutionRef() + "-step-" + code + "-output.txt", "text/plain", bytes, stepExecId, e, code, user);
            } else {
                sha = RunbookTreeService.sha256(notBlank(externalRef) ? externalRef.trim() : attestationText.trim());
            }
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Storing evidence failed", ex);
        }
        RunbookEvidenceItem item = evidence.save(RunbookEvidenceItem.builder()
            .stepExecId(stepExecId).reqId(reqId).evidenceType(type).fileId(fileId)
            .externalRef(notBlank(externalRef) ? externalRef.trim() : null)
            .attestationText(notBlank(attestationText) ? attestationText.trim() : null)
            .sha256(sha).retentionYears(req != null ? req.getRetentionYears() : 7)
            .capturedByUserId(user.getUserId()).isImmutable(true).build());
        e.setEvidenceCount((e.getEvidenceCount() == null ? 0 : e.getEvidenceCount()) + 1);
        executions.save(e);
        audit.log(user.getUserId(), "evidence_captured", SUBJECT_EXECUTION, execId,
            Map.of("evidenceId", item.getEvidenceId(), "stepCode", code, "type", type, "sha256", sha));
        return detail(e);
    }

    private Long storeFile(String name, String mime, byte[] bytes, Long stepExecId, RunbookExecution e, String code, User user) throws Exception {
        String path = storage.storeBytes(name, bytes);
        EvidenceFile f = evidenceFiles.save(EvidenceFile.builder()
            .fileName(path.substring(path.lastIndexOf(java.io.File.separator) + 1)).originalName(name)
            .mimeType(mime != null ? mime : "application/octet-stream").fileSize((long) bytes.length).storagePath(path)
            .sourceType(EVIDENCE_SOURCE_STEP).sourceId(stepExecId)
            .description("Runbook " + e.getExecutionRef() + " step " + code).uploadedByUserId(user.getUserId()).build());
        return f.getFileId();
    }

    @Transactional(readOnly = true)
    public List<EvidenceItemDto> stepEvidence(Long execId, Long stepExecId) {
        findStep(execId, stepExecId);
        return evidenceDtos(evidence.findByStepExecIdOrderByCapturedAtAsc(stepExecId));
    }

    /** Returns [file, bytes] for an evidence item of this execution. */
    @Transactional(readOnly = true)
    public Map.Entry<EvidenceFile, byte[]> downloadEvidence(Long execId, Long evidenceId) {
        RunbookEvidenceItem item = evidence.findById(evidenceId).orElseThrow(() -> ApiException.notFound("Evidence not found"));
        findStep(execId, item.getStepExecId());
        if (item.getFileId() == null) throw ApiException.notFound("This evidence item has no file");
        EvidenceFile f = evidenceFiles.findById(item.getFileId()).orElseThrow(() -> ApiException.notFound("Evidence file not found"));
        try {
            return Map.entry(f, storage.load(f.getStoragePath()));
        } catch (java.nio.file.NoSuchFileException ex) {
            throw new com.atheris.compliance.tenant.backend.shared.exception.DocumentUnavailableException("The stored evidence file is no longer available");
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Reading evidence failed", ex);
        }
    }

    // ── execution-level actions ─────────────────────────────────────────────

    @Transactional
    public ExecutionDetailDto pause(Long execId, String reason, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        requireRunControl(e, user);
        if (!WORKABLE_EXECUTION_STATUSES.contains(e.getStatus())) throw ApiException.conflict("Only a running execution can be paused");
        e.setStatusBeforePause(e.getStatus());
        e.setStatus(EX_PAUSED);
        executions.save(e);
        audit.log(user.getUserId(), "execution_paused", SUBJECT_EXECUTION, execId, Map.of("reason", String.valueOf(reason)));
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto resume(Long execId, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        requireRunControl(e, user);
        if (!EX_PAUSED.equals(e.getStatus()) && !EX_ESCALATED.equals(e.getStatus())) {
            throw ApiException.conflict("Only a paused or escalated execution can be resumed");
        }
        // A paused rollback resumes rolling back; everything else (incl. an escalated halt) resumes the procedure.
        String back = EX_PAUSED.equals(e.getStatus()) && EX_ROLLING_BACK.equals(e.getStatusBeforePause())
            ? EX_ROLLING_BACK : EX_IN_PROGRESS;
        e.setStatus(back);
        e.setStatusBeforePause(null);
        executions.save(e);
        audit.log(user.getUserId(), "execution_resumed", SUBJECT_EXECUTION, execId, Map.of("status", back));
        afterStepChange(e);
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto abort(Long execId, String reason, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        requireRunControl(e, user);
        if (CLOSED_EXECUTION_STATUSES.contains(e.getStatus()) || EX_PENDING_SIGNOFF.equals(e.getStatus())) {
            throw ApiException.conflict("The execution is already finished");
        }
        if (reason == null || reason.trim().length() < 5) throw ApiException.badRequest("Give a reason for aborting");
        Instant now = Instant.now();
        e.setStatus(EX_ABORTED);
        e.setOutcome(OUTCOME_FAIL);
        e.setOutcomeSummary("Aborted: " + reason.trim());
        e.setCompletedAt(now);
        e.setClosedAt(now);
        executions.save(e);
        closeOpenEscalations(e, user.getUserId(), "Closed with the execution (aborted)");
        audit.log(user.getUserId(), "execution_aborted", SUBJECT_EXECUTION, execId, Map.of("reason", reason.trim()));
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto escalate(Long execId, EscalateRequest req, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        if (CLOSED_EXECUTION_STATUSES.contains(e.getStatus())) throw ApiException.conflict("The execution is closed");
        Runbook rb = runbookService.find(e.getRunbookId());
        int level = req.getLevel() != null ? req.getLevel() : 1;
        List<RunbookEscalationPath> paths = escalationPaths.findByVersionIdOrderByLevelAsc(e.getVersionId()).stream()
            .filter(p -> p.getLevel() == level).toList();
        String msg = rb.getRunbookCode() + " " + e.getExecutionRef() + " escalated by " + user.getFullName()
            + (notBlank(req.getMessage()) ? ": " + req.getMessage().trim() : "");
        if (paths.isEmpty()) {
            sendEscalation(e, rb, level, TRIG_MANUAL, AppRole.CCO, null, "IN_APP", msg);
        } else {
            paths.forEach(p -> sendEscalation(e, rb, level, TRIG_MANUAL, p.getNotifyRole(), p.getNotifyUserId(), p.getNotifyChannel(), msg));
        }
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto acknowledge(Long execId, Long escId, User user) {
        RunbookExecution e = find(execId);
        RunbookExecutionEscalation esc = execEscalations.findById(escId)
            .filter(x -> x.getExecutionId().equals(execId)).orElseThrow(() -> ApiException.notFound("Escalation not found"));
        if (esc.getAcknowledgedAt() != null) throw ApiException.conflict("Already acknowledged");
        if (AppRole.AUDITOR.equals(user.getRole())) throw ApiException.conflict("Auditors have read-only access");
        esc.setAcknowledgedAt(Instant.now());
        esc.setAcknowledgedByUserId(user.getUserId());
        execEscalations.save(esc);
        audit.log(user.getUserId(), "escalation_acknowledged", SUBJECT_EXECUTION, execId, Map.of("escalationId", escId));
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto rollback(Long execId, String reason, User user) {
        requireExecutor(user);
        RunbookExecution e = find(execId);
        requireRunControl(e, user);
        if (!Set.of(EX_IN_PROGRESS, EX_ESCALATED, EX_PAUSED).contains(e.getStatus())) {
            throw ApiException.conflict("Rollback can only be triggered on a running, paused or escalated execution");
        }
        if (reason == null || reason.isBlank()) throw ApiException.badRequest("Give a reason for the rollback");
        List<RunbookRollbackStep> plan = rollbackSteps.findByVersionIdOrderBySortOrderAsc(e.getVersionId());
        if (plan.isEmpty()) throw ApiException.conflict("no_rollback_plan", "This runbook version has no rollback steps");
        List<RunbookStepExecution> existing = stepExecs.findByExecutionIdOrderBySortOrderAsc(execId);
        if (existing.stream().anyMatch(x -> x.getRollbackId() != null)) throw ApiException.conflict("Rollback has already been triggered");
        // Steps that never ran are abandoned; they stay visible as N/A in the record.
        existing.stream().filter(x -> ST_PENDING.equals(x.getStatus())).forEach(x -> {
            x.setStatus(ST_NA);
            x.setSkipReason("Not run — execution rolled back");
            x.setCompletedAt(Instant.now());
            stepExecs.save(x);
        });
        int order = existing.stream().mapToInt(RunbookStepExecution::getSortOrder).max().orElse(0) + 1;
        for (RunbookRollbackStep r : plan) {
            stepExecs.save(RunbookStepExecution.builder().executionId(execId).rollbackId(r.getRollbackId())
                .sortOrder(order++).status(ST_PENDING).build());
        }
        e.setStatus(EX_ROLLING_BACK);
        e.setStatusBeforePause(null);
        executions.save(e);
        audit.log(user.getUserId(), "rollback_triggered", SUBJECT_EXECUTION, execId,
            Map.of("reason", reason.trim(), "rollbackSteps", plan.size()));
        recount(e);
        return detail(e);
    }

    @Transactional
    public ExecutionDetailDto signoff(Long execId, SignoffRequest req, User user) {
        RunbookExecution e = find(execId);
        boolean pending = EX_PENDING_SIGNOFF.equals(e.getStatus());
        boolean closed = EX_COMPLETED_PASS.equals(e.getStatus()) || EX_COMPLETED_FAIL.equals(e.getStatus());
        if (!pending && !closed) throw ApiException.conflict("The execution is not ready for sign-off (status " + e.getStatus() + ")");
        String role = req.getRole();
        String decision = req.getDecision();
        if (!DECISION_ACCEPTED.equals(decision) && !DECISION_REJECTED.equals(decision)) {
            throw ApiException.badRequest("Decision must be ACCEPTED or REJECTED");
        }
        String userRole = user.getRole();
        switch (role == null ? "" : role) {
            case SIGN_CCO -> {
                if (!AppRole.CCO.equals(userRole) && !AppRole.TENANT_ADMIN.equals(userRole)) throw forbidden("Only a CCO or Tenant Admin can give the CCO sign-off");
                if (!pending) throw ApiException.conflict("The CCO sign-off has already closed this execution");
            }
            case SIGN_AUDITOR -> {
                if (!AppRole.AUDITOR.equals(userRole)) throw forbidden("Only an Auditor can record the auditor acceptance");
            }
            case SIGN_REVIEWER -> {
                if (!Set.of(AppRole.ANALYST, AppRole.CCO, AppRole.TENANT_ADMIN).contains(userRole)) throw forbidden("Reviewer sign-off needs an Analyst, CCO or Tenant Admin");
                if (user.getUserId().equals(e.getOperatorUserId())) throw ApiException.conflict("The operator cannot review their own execution");
            }
            case SIGN_OPERATOR -> {
                if (!user.getUserId().equals(e.getOperatorUserId())) throw forbidden("Only the operator can give the operator sign-off");
            }
            default -> throw ApiException.badRequest("Invalid sign-off role: " + role);
        }
        Evidence ev = evidenceCompleteness(e);
        if (DECISION_ACCEPTED.equals(decision) && ev.missing > 0) {
            throw ApiException.conflict("evidence_incomplete", ev.missing + " mandatory evidence item(s) are missing — the run cannot be accepted");
        }
        signoffs.save(RunbookExecutionSignoff.builder().executionId(execId).signoffRole(role).userId(user.getUserId())
            .decision(decision).comment(RunbookTreeService.blankToNull(req.getComment())).build());
        audit.log(user.getUserId(), "signoff", SUBJECT_EXECUTION, execId, Map.of("role", role, "decision", decision));
        if (SIGN_CCO.equals(role) && DECISION_ACCEPTED.equals(decision)) {
            close(e, user);
        }
        return detail(e);
    }

    /** A finished run leaves no escalation open (they used to keep counting as "open escalations"). */
    private void closeOpenEscalations(RunbookExecution e, Integer userId, String note) {
        List<RunbookExecutionEscalation> open = execEscalations.findByExecutionIdAndAcknowledgedAtIsNull(e.getExecutionId());
        if (open.isEmpty()) return;
        Instant now = Instant.now();
        for (RunbookExecutionEscalation esc : open) {
            esc.setAcknowledgedAt(now);
            esc.setAcknowledgedByUserId(userId);
            esc.setNotes(esc.getNotes() == null ? note : esc.getNotes() + " · " + note);
        }
        execEscalations.saveAll(open);
    }

    /** Open escalations of runs that are still going (closed runs' leftovers don't count). */
    long openEscalationCount() {
        List<Long> closed = executions.findByStatusIn(CLOSED_EXECUTION_STATUSES).stream()
            .map(RunbookExecution::getExecutionId).toList();
        return closed.isEmpty() ? execEscalations.countByAcknowledgedAtIsNull()
            : execEscalations.countByAcknowledgedAtIsNullAndExecutionIdNotIn(closed);
    }

    /** CCO acceptance closes the run and feeds the linked controls' test history (spec §8.6). */
    private void close(RunbookExecution e, User signer) {
        Instant now = Instant.now();
        boolean pass = OUTCOME_PASS.equals(e.getOutcome());
        e.setStatus(pass ? EX_COMPLETED_PASS : EX_COMPLETED_FAIL);
        e.setClosedAt(now);
        executions.save(e);
        closeOpenEscalations(e, signer.getUserId(), "Closed with the execution (signed off)");
        Runbook rb = runbookService.find(e.getRunbookId());
        List<Integer> controlIds = rb.getLinkedControlIds().stream().map(Long::intValue).toList();
        if (!controlIds.isEmpty()) {
            User operator = users.findById(e.getOperatorUserId()).orElse(signer);
            for (Control c : controls.findAllById(controlIds)) {
                RecordTestRequest t = new RecordTestRequest();
                t.setTestDate(LocalDate.now(ZoneId.of("Africa/Lagos")));
                t.setTestedByName(operator.getFullName());
                t.setResult(pass ? WorkflowStatus.TEST_PASSED : WorkflowStatus.TEST_FAILED);
                t.setResultDescription("Runbook " + rb.getRunbookCode() + " execution " + e.getExecutionRef() + " — "
                    + e.getStepsPassed() + " passed, " + e.getStepsFailed() + " failed, " + e.getStepsSkipped() + " skipped/N/A");
                t.setFailureDetails(pass ? null : e.getOutcomeSummary());
                t.setEvidenceUrl("/runbooks/executions/" + e.getExecutionId() + "/summary");
                controlTests.recordTest(c.getControlId(), t, operator);
            }
        }
        audit.log(signer.getUserId(), "execution_closed", SUBJECT_EXECUTION, e.getExecutionId(),
            Map.of("status", e.getStatus(), "controlTests", controlIds.size()));
    }

    private static ApiException forbidden(String msg) {
        return new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "forbidden", msg);
    }

    @Transactional(readOnly = true)
    public List<TimelineEventDto> timeline(Long execId) {
        find(execId);
        List<AuditEvent> rows = audit.findBySubject(SUBJECT_EXECUTION, execId, PageRequest.of(0, 500)).getContent();
        Map<Integer, String> names = tree.userNames(rows.stream().map(AuditEvent::getActorUserId).toList());
        return rows.stream().map(a -> TimelineEventDto.builder().eventId(a.getEventId()).action(a.getAction())
            .actorName(names.getOrDefault(a.getActorUserId(), "System")).occurredAt(a.getOccurredAt())
            .afterJson(a.getAfterJson()).build()).toList();
    }

    // ── state helpers ───────────────────────────────────────────────────────

    /** Recounts and moves the run to PENDING_SIGNOFF once every step is terminal. */
    void afterStepChange(RunbookExecution e) {
        List<RunbookStepExecution> all = recount(e);
        if (EX_ROLLING_BACK.equals(e.getStatus())) {
            List<RunbookStepExecution> rb = all.stream().filter(x -> x.getRollbackId() != null).toList();
            if (!rb.isEmpty() && rb.stream().allMatch(x -> TERMINAL_STEP_STATUSES.contains(x.getStatus()))) {
                boolean rbFailed = rb.stream().anyMatch(x -> ST_FAILED.equals(x.getStatus()));
                finish(e, OUTCOME_FAIL, rbFailed ? "Rolled back — a rollback step failed" : "Rolled back successfully");
            }
            return;
        }
        if (!EX_IN_PROGRESS.equals(e.getStatus()) && !EX_ESCALATED.equals(e.getStatus())) return;
        List<RunbookStepExecution> normal = all.stream().filter(x -> x.getRollbackId() == null).toList();
        if (!normal.isEmpty() && normal.stream().allMatch(x -> TERMINAL_STEP_STATUSES.contains(x.getStatus()))) {
            long failed = normal.stream().filter(x -> ST_FAILED.equals(x.getStatus())).count();
            finish(e, failed > 0 ? OUTCOME_FAIL : OUTCOME_PASS,
                failed > 0 ? failed + " step(s) failed" : "All steps completed");
        }
    }

    private void finish(RunbookExecution e, String outcome, String summary) {
        e.setOutcome(outcome);
        e.setOutcomeSummary(summary);
        e.setCompletedAt(Instant.now());
        e.setStatus(EX_PENDING_SIGNOFF);
        executions.save(e);
        audit.log(null, "execution_completed", SUBJECT_EXECUTION, e.getExecutionId(), Map.of("outcome", outcome));
        notifications.notifyRoleEmailed(AppRole.CCO, NOTIFICATION_CATEGORY, NotificationConstants.SEVERITY_MEDIUM,
            "Runbook execution " + e.getExecutionRef() + " is ready for sign-off (" + outcome + ")",
            "/runbooks/executions/" + e.getExecutionId() + "/summary",
            "Sign-off needed: " + e.getExecutionRef());
    }

    private List<RunbookStepExecution> recount(RunbookExecution e) {
        List<RunbookStepExecution> all = stepExecs.findByExecutionIdOrderBySortOrderAsc(e.getExecutionId());
        e.setStepsTotal(all.size());
        e.setStepsPassed((int) all.stream().filter(x -> ST_PASSED.equals(x.getStatus())).count());
        e.setStepsFailed((int) all.stream().filter(x -> ST_FAILED.equals(x.getStatus())).count());
        e.setStepsSkipped((int) all.stream().filter(x -> ST_SKIPPED.equals(x.getStatus()) || ST_NA.equals(x.getStatus())).count());
        executions.save(e);
        return all;
    }

    private void requireWorkable(RunbookExecution e, RunbookStepExecution s) {
        boolean rollback = s.getRollbackId() != null;
        if (rollback && !EX_ROLLING_BACK.equals(e.getStatus())) throw ApiException.conflict("Rollback steps run only while rolling back");
        if (!rollback && !EX_IN_PROGRESS.equals(e.getStatus())) {
            throw ApiException.conflict("execution_not_running", switch (e.getStatus()) {
                case EX_PREFLIGHT, EX_NOT_STARTED -> "Complete the pre-flight checklist first";
                case EX_PAUSED -> "The execution is paused — resume it first";
                case EX_ESCALATED -> "A blocking step failed — resume, roll back or abort the execution";
                case EX_ROLLING_BACK -> "The execution is rolling back";
                default -> "The execution is " + e.getStatus();
            });
        }
    }

    /**
     * A step assigned to an application role (ANALYST, CCO, IT_OPS, TENANT_ADMIN) may only be worked
     * by a user holding that role — a CCO may also perform Analyst steps. Roles the tenant has no
     * user role for (CISO, DPO, …) are descriptive and open to any executor. Rollback steps follow
     * the same rule through their own definition when they carry one.
     */
    private static void requireStepActor(RunbookExecution e, RunbookStepExecution s, StepDefs defs, User u) {
        RunbookStep def = s.getStepId() != null ? defs.steps.get(s.getStepId()) : null;
        String required = def != null ? def.getAssignedRole() : null;
        if (!roleMayPerform(required, u.getRole())) {
            throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "step_role_required",
                "This step is assigned to the " + required + " role");
        }
        // A step not assigned to an app role belongs to the run's operator (or a CCO / tenant admin
        // standing in) — another user cannot work someone else's run.
        if (!isAppRole(required) && !mayActForOperator(e, u)) {
            throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "not_operator",
                "Only the operator of this run (or a CCO) can work this step");
        }
    }

    /** Pause / resume / roll back / abort: the operator, or a CCO or tenant admin. */
    private static void requireRunControl(RunbookExecution e, User u) {
        if (!mayActForOperator(e, u)) {
            throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "not_operator",
                "Only the operator of this run (or a CCO) can pause, roll back or abort it");
        }
    }

    static boolean mayActForOperator(RunbookExecution e, User u) {
        return (e.getOperatorUserId() != null && e.getOperatorUserId().equals(u.getUserId()))
            || AppRole.CCO.equals(u.getRole()) || AppRole.TENANT_ADMIN.equals(u.getRole());
    }

    static boolean isAppRole(String role) {
        return role != null && !role.isBlank() && EXECUTOR_ROLES.contains(role.trim().toUpperCase(java.util.Locale.ROOT));
    }

    /**
     * Whether an evidence payload fits the requirement it is captured against: a screenshot must be
     * an image (or PDF), a log/query/config export a text-type file, an attestation the attestation
     * text, a ticket the external reference. A requirement's own accepted MIME list wins.
     */
    static String evidenceMismatch(String type, List<String> acceptedMime, String ext, String mime,
                                   boolean file, boolean pasted, boolean externalRef, boolean attestation) {
        if (file && acceptedMime != null && !acceptedMime.isEmpty()) {
            return mime != null && acceptedMime.stream().anyMatch(m -> mime.equalsIgnoreCase(m.trim()))
                ? null : "This evidence must be one of: " + String.join(", ", acceptedMime);
        }
        Set<String> images = Set.of("png", "jpg", "jpeg", "gif", "webp", "pdf");
        Set<String> text = Set.of("txt", "log", "csv", "json", "xml", "yaml", "yml", "cfg", "conf", "md", "html", "xlsx", "xls", "zip");
        return switch (type == null ? "" : type) {
            case "SCREENSHOT" -> file && images.contains(ext) ? null : "A screenshot must be an image or PDF file";
            case "SIGNED_FORM" -> file && Set.of("pdf", "png", "jpg", "jpeg").contains(ext) ? null : "A signed form must be a PDF or image file";
            case "EMAIL" -> file && Set.of("eml", "msg", "pdf").contains(ext) ? null : "An email must be an .eml, .msg or PDF file";
            case "LOG_FILE", "CONFIG_EXPORT" -> (file && text.contains(ext)) || pasted ? null
                : "A log or configuration export must be a text-type file or pasted output";
            case "QUERY_OUTPUT" -> (file && text.contains(ext)) || pasted ? null : "Query output must be pasted or a text-type file";
            case "ATTESTATION" -> attestation ? null : "This requirement is an attestation — enter the attestation text";
            case "TICKET_REF" -> externalRef ? null : "This requirement is a ticket — give its reference";
            default -> null;
        };
    }

    static boolean roleMayPerform(String required, String userRole) {
        if (required == null || required.isBlank()) return true;
        String r = required.trim().toUpperCase(java.util.Locale.ROOT);
        if (!EXECUTOR_ROLES.contains(r)) return true;
        if (r.equals(userRole)) return true;
        return AppRole.ANALYST.equals(r) && AppRole.CCO.equals(userRole);
    }

    private static void requireExecutor(User u) {
        if (!EXECUTOR_ROLES.contains(u.getRole())) {
            throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "forbidden", "Your role cannot execute runbooks");
        }
    }

    private User activeUser(Integer id) {
        User u = users.findById(id).orElseThrow(() -> ApiException.badRequest("User not found: " + id));
        if (Boolean.FALSE.equals(u.getIsActive())) throw ApiException.badRequest("The operator must be an active user");
        return u;
    }

    public RunbookExecution find(Long execId) {
        return executions.findById(execId).orElseThrow(() -> ApiException.notFound("Execution not found: " + execId));
    }

    private RunbookStepExecution findStep(Long execId, Long stepExecId) {
        return stepExecs.findByStepExecIdAndExecutionId(stepExecId, execId)
            .orElseThrow(() -> ApiException.notFound("Step " + stepExecId + " is not part of execution " + execId));
    }

    private Long raiseFinding(RunbookExecution e, Runbook rb, String code, String actual, User user) {
        String severity = switch (rb.getCriticality()) {
            case "CRITICAL" -> WorkflowStatus.RISK_CRITICAL;
            case "HIGH" -> WorkflowStatus.RISK_HIGH;
            case "MEDIUM" -> WorkflowStatus.RISK_MEDIUM;
            default -> WorkflowStatus.RISK_LOW;
        };
        RaiseFindingRequest f = new RaiseFindingRequest();
        f.setFindingType("Control Failure");
        f.setSeverity(severity);
        f.setDescription("Runbook " + rb.getRunbookCode() + " (" + rb.getTitle() + "), execution " + e.getExecutionRef()
            + ": step " + code + " failed. " + actual);
        f.setLinkedObligationId(rb.getLinkedObligationIds().isEmpty() ? null : rb.getLinkedObligationIds().get(0));
        f.setLinkedControlId(rb.getLinkedControlIds().isEmpty() ? null : rb.getLinkedControlIds().get(0).intValue());
        f.setRemediationDeadline(LocalDate.now().plusDays(FindingService.slaDays(severity)));
        FindingRaisedResponse r = findings.manualRaise(f, user.getUserId());
        audit.log(user.getUserId(), "finding_raised_from_runbook", SUBJECT_EXECUTION, e.getExecutionId(),
            Map.of("findingId", r.getFindingId(), "stepCode", code));
        return r.getFindingId();
    }

    // ── escalation ──────────────────────────────────────────────────────────

    /**
     * Sends the escalation levels configured for {@code trigger} (up to {@code maxLevel} when given);
     * falls back to the CCO when the version defines none.
     */
    void escalateByTrigger(RunbookExecution e, Runbook rb, String trigger, int maxLevel, String message) {
        List<RunbookEscalationPath> paths = escalationPaths.findByVersionIdOrderByLevelAsc(e.getVersionId()).stream()
            .filter(p -> trigger.equals(p.getTriggerType()) || (maxLevel > 0 && p.getLevel() <= maxLevel && TRIG_STEP_FAILED.equals(trigger)))
            .toList();
        if (paths.isEmpty()) {
            sendEscalation(e, rb, Math.max(1, maxLevel), trigger, AppRole.CCO, null, "IN_APP", message);
            return;
        }
        paths.forEach(p -> sendEscalation(e, rb, p.getLevel(), trigger, p.getNotifyRole(), p.getNotifyUserId(), p.getNotifyChannel(), message));
    }

    void sendEscalation(RunbookExecution e, Runbook rb, int level, String trigger, String role, Integer userId,
                        String channel, String message) {
        String link = "/runbooks/executions/" + e.getExecutionId();
        String severity = "CRITICAL".equals(rb.getCriticality()) || "HIGH".equals(rb.getCriticality())
            ? NotificationConstants.SEVERITY_HIGH : NotificationConstants.SEVERITY_MEDIUM;
        boolean email = CHANNEL_EMAIL.equals(channel);
        String subject = "Runbook escalation L" + level + ": " + rb.getRunbookCode() + " " + e.getExecutionRef();
        if (userId != null) {
            if (email) notifications.notifyUserEmailed(userId, NOTIFICATION_CATEGORY, severity, message, link, subject);
            else notifications.notifyUser(userId, NOTIFICATION_CATEGORY, severity, message, link);
        }
        if (role != null) {
            if (email) notifications.notifyRoleEmailed(role, NOTIFICATION_CATEGORY, severity, message, link, subject);
            else notifications.notifyRole(role, NOTIFICATION_CATEGORY, severity, message, link);
        }
        RunbookExecutionEscalation row = execEscalations.save(RunbookExecutionEscalation.builder().executionId(e.getExecutionId())
            .level(level).triggerType(trigger).notifiedRole(role).notifiedUserId(userId).channel(channel).notes(message).build());
        audit.log(null, "escalation_sent", SUBJECT_EXECUTION, e.getExecutionId(),
            Map.of("escalationId", row.getExecEscId(), "level", level, "trigger", trigger, "role", String.valueOf(role)));
    }

    /**
     * SLA timers (spec §8.2): 50% → in-app warning to the operator; 80% → SLA_80 escalation levels;
     * 100% → SLA_BREACH levels + audit event. Each threshold fires once per execution.
     */
    @Transactional
    public void slaTick(Long execId) {
        RunbookExecution e = find(execId);
        if (!ACTIVE_EXECUTION_STATUSES.contains(e.getStatus()) || e.getDueAt() == null) return;
        Instant start = e.getStartedAt() != null ? e.getStartedAt() : e.getCreatedAt();
        long total = Duration.between(start, e.getDueAt()).toSeconds();
        if (total <= 0) return;
        double pct = (double) Duration.between(start, Instant.now()).toSeconds() / total;
        Runbook rb = runbookService.find(e.getRunbookId());
        if (pct >= 0.5 && !execEscalations.existsByExecutionIdAndTriggerType(execId, TRIG_SLA_50)) {
            sendEscalation(e, rb, 0, TRIG_SLA_50, null, e.getOperatorUserId(), "IN_APP",
                "50% of the SLA has elapsed on " + rb.getRunbookCode() + " " + e.getExecutionRef());
        }
        if (pct >= 0.8 && !execEscalations.existsByExecutionIdAndTriggerType(execId, TRIG_SLA_80)) {
            escalateByTrigger(e, rb, TRIG_SLA_80, 0, "80% of the SLA has elapsed on " + rb.getRunbookCode() + " "
                + e.getExecutionRef() + " — due " + e.getDueAt());
        }
        if (pct >= 1.0 && !execEscalations.existsByExecutionIdAndTriggerType(execId, TRIG_SLA_BREACH)) {
            escalateByTrigger(e, rb, TRIG_SLA_BREACH, 0, "SLA BREACHED on " + rb.getRunbookCode() + " " + e.getExecutionRef());
            audit.log(null, "sla_breached", SUBJECT_EXECUTION, execId, Map.of("dueAt", e.getDueAt().toString()));
        }
    }

    // ── detail ──────────────────────────────────────────────────────────────

    private record StepDefs(Map<Long, RunbookStep> steps, Map<Long, RunbookSection> sectionByStep,
                            Map<Long, List<RunbookStepEvidenceReq>> reqs, Map<Long, RunbookRollbackStep> rollbacks) {}

    private final RunbookSectionRepository sectionRepo;
    private final RunbookStepRepository stepRepo;
    private final RunbookStepEvidenceReqRepository reqRepo;

    private StepDefs stepDefs(Long versionId) {
        List<RunbookSection> secs = sectionRepo.findByVersionIdOrderBySortOrderAsc(versionId);
        Map<Long, RunbookSection> secById = secs.stream().collect(Collectors.toMap(RunbookSection::getSectionId, Function.identity()));
        List<RunbookStep> stepRows = secs.isEmpty() ? List.of() : stepRepo.findBySectionIdInOrderBySortOrderAsc(secById.keySet());
        Map<Long, RunbookStep> steps = stepRows.stream().collect(Collectors.toMap(RunbookStep::getStepId, Function.identity()));
        Map<Long, RunbookSection> sectionByStep = new HashMap<>();
        stepRows.forEach(s -> sectionByStep.put(s.getStepId(), secById.get(s.getSectionId())));
        Map<Long, List<RunbookStepEvidenceReq>> reqs = steps.isEmpty() ? Map.of()
            : reqRepo.findByStepIdIn(steps.keySet()).stream().sorted(Comparator.comparing(RunbookStepEvidenceReq::getReqId))
                .collect(Collectors.groupingBy(RunbookStepEvidenceReq::getStepId));
        Map<Long, RunbookRollbackStep> rbs = rollbackSteps.findByVersionIdOrderBySortOrderAsc(versionId).stream()
            .collect(Collectors.toMap(RunbookRollbackStep::getRollbackId, Function.identity()));
        return new StepDefs(steps, sectionByStep, reqs, rbs);
    }

    private Map<Long, Boolean> blockingByStepId(Long versionId) {
        Map<Long, Boolean> m = new HashMap<>();
        stepDefs(versionId).steps.values().forEach(s -> m.put(s.getStepId(), s.getIsBlocking()));
        return m;
    }

    private String stepCode(RunbookStepExecution s, StepDefs d) {
        if (s.getStepId() != null && d.steps.containsKey(s.getStepId())) return String.valueOf(d.steps.get(s.getStepId()).getStepCode());
        if (s.getRollbackId() != null && d.rollbacks.containsKey(s.getRollbackId())) return "RB-" + (d.rollbacks.get(s.getRollbackId()).getSortOrder() + 1);
        return String.valueOf(s.getStepExecId());
    }

    /** A requirement is satisfied by evidence linked to it, or by unlinked evidence of the same type. */
    private List<RunbookStepEvidenceReq> missingMandatory(RunbookStepExecution s, StepDefs d, List<RunbookEvidenceItem> items) {
        if (s.getStepId() == null) return List.of();
        List<RunbookEvidenceItem> pool = new ArrayList<>(items);
        List<RunbookStepEvidenceReq> missing = new ArrayList<>();
        List<RunbookStepEvidenceReq> reqs = d.reqs.getOrDefault(s.getStepId(), List.of());
        // Linked evidence first, so an unlinked item is not consumed by a requirement that has its own.
        for (RunbookStepEvidenceReq r : reqs) {
            pool.stream().filter(i -> r.getReqId().equals(i.getReqId())).findFirst().ifPresent(pool::remove);
        }
        for (RunbookStepEvidenceReq r : reqs) {
            boolean linked = items.stream().anyMatch(i -> r.getReqId().equals(i.getReqId()));
            if (linked) continue;
            Optional<RunbookEvidenceItem> loose = pool.stream()
                .filter(i -> i.getReqId() == null && r.getEvidenceType().equals(i.getEvidenceType())).findFirst();
            if (loose.isPresent()) {
                pool.remove(loose.get());
            } else if (Boolean.TRUE.equals(r.getIsMandatory())) {
                missing.add(r);
            }
        }
        return missing;
    }

    private record Evidence(int total, int missing) {}

    private Evidence evidenceCompleteness(RunbookExecution e) {
        StepDefs d = stepDefs(e.getVersionId());
        List<RunbookStepExecution> all = stepExecs.findByExecutionIdOrderBySortOrderAsc(e.getExecutionId());
        Map<Long, List<RunbookEvidenceItem>> items = evidence.findByStepExecIdInOrderByCapturedAtAsc(
            all.stream().map(RunbookStepExecution::getStepExecId).toList()).stream()
            .collect(Collectors.groupingBy(RunbookEvidenceItem::getStepExecId));
        int total = 0, missing = 0;
        for (RunbookStepExecution s : all) {
            if (!ST_PASSED.equals(s.getStatus()) && !ST_AWAITING_VERIFICATION.equals(s.getStatus())) continue;
            total += (int) d.reqs.getOrDefault(s.getStepId(), List.of()).stream().filter(r -> Boolean.TRUE.equals(r.getIsMandatory())).count();
            missing += missingMandatory(s, d, items.getOrDefault(s.getStepExecId(), List.of())).size();
        }
        return new Evidence(total, missing);
    }

    private List<EvidenceItemDto> evidenceDtos(List<RunbookEvidenceItem> items) {
        Map<Long, EvidenceFile> files = evidenceFiles.findAllById(items.stream().map(RunbookEvidenceItem::getFileId)
            .filter(Objects::nonNull).toList()).stream().collect(Collectors.toMap(EvidenceFile::getFileId, Function.identity()));
        Map<Integer, String> names = tree.userNames(items.stream().map(RunbookEvidenceItem::getCapturedByUserId).toList());
        return items.stream().map(i -> {
            EvidenceFile f = i.getFileId() != null ? files.get(i.getFileId()) : null;
            return EvidenceItemDto.builder().evidenceId(i.getEvidenceId()).stepExecId(i.getStepExecId()).reqId(i.getReqId())
                .evidenceType(i.getEvidenceType()).fileId(i.getFileId())
                .fileName(f != null ? f.getOriginalName() : null).mimeType(f != null ? f.getMimeType() : null)
                .fileSize(f != null ? f.getFileSize() : null).externalRef(i.getExternalRef())
                .attestationText(i.getAttestationText()).sha256(i.getSha256())
                .capturedByUserId(i.getCapturedByUserId()).capturedByName(names.get(i.getCapturedByUserId()))
                .capturedAt(i.getCapturedAt()).build();
        }).toList();
    }

    @Transactional(readOnly = true)
    public ExecutionDetailDto detail(Long execId) {
        return detail(find(execId));
    }

    @Transactional(readOnly = true)
    public ExecutionDetailDto detail(RunbookExecution e) {
        Runbook rb = runbookService.find(e.getRunbookId());
        RunbookVersion v = versions.findById(e.getVersionId()).orElseThrow();
        StepDefs d = stepDefs(e.getVersionId());
        List<RunbookStepExecution> rows = stepExecs.findByExecutionIdOrderBySortOrderAsc(e.getExecutionId());
        List<RunbookEvidenceItem> items = evidence.findByStepExecIdInOrderByCapturedAtAsc(rows.stream().map(RunbookStepExecution::getStepExecId).toList());
        Map<Long, List<EvidenceItemDto>> evByStep = evidenceDtos(items).stream().collect(Collectors.groupingBy(EvidenceItemDto::getStepExecId));
        Map<Long, List<RunbookEvidenceItem>> rawByStep = items.stream().collect(Collectors.groupingBy(RunbookEvidenceItem::getStepExecId));
        List<RunbookExecutionEscalation> escs = execEscalations.findByExecutionIdOrderBySentAtAsc(e.getExecutionId());
        List<RunbookExecutionSignoff> signs = signoffs.findByExecutionIdOrderBySignedAtAsc(e.getExecutionId());
        Set<Integer> uids = new HashSet<>();
        rows.forEach(r -> { uids.add(r.getPerformedByUserId()); uids.add(r.getVerifiedByUserId()); });
        escs.forEach(x -> { uids.add(x.getNotifiedUserId()); uids.add(x.getAcknowledgedByUserId()); });
        signs.forEach(x -> uids.add(x.getUserId()));
        Map<Integer, String> names = tree.userNames(uids);

        List<StepExecutionDto> steps = rows.stream().map(r -> {
            RunbookStep st = r.getStepId() != null ? d.steps.get(r.getStepId()) : null;
            RunbookRollbackStep rbs = r.getRollbackId() != null ? d.rollbacks.get(r.getRollbackId()) : null;
            RunbookSection sec = st != null ? d.sectionByStep.get(st.getStepId()) : null;
            List<RunbookEvidenceItem> raw = rawByStep.getOrDefault(r.getStepExecId(), List.of());
            List<RunbookStepEvidenceReq> missing = missingMandatory(r, d, raw);
            Set<Long> missingIds = missing.stream().map(RunbookStepEvidenceReq::getReqId).collect(Collectors.toSet());
            StepExecutionDto.StepExecutionDtoBuilder b = StepExecutionDto.builder()
                .stepExecId(r.getStepExecId()).stepId(r.getStepId()).rollbackId(r.getRollbackId()).rollback(rbs != null)
                .sortOrder(r.getSortOrder()).status(r.getStatus()).actualResult(r.getActualResult())
                .operatorNotes(r.getOperatorNotes()).failureCategory(r.getFailureCategory()).skipReason(r.getSkipReason())
                .performedByUserId(r.getPerformedByUserId()).performedByName(names.get(r.getPerformedByUserId()))
                .verifiedByUserId(r.getVerifiedByUserId()).verifiedByName(names.get(r.getVerifiedByUserId()))
                .startedAt(r.getStartedAt()).completedAt(r.getCompletedAt())
                .evidence(evByStep.getOrDefault(r.getStepExecId(), List.of()))
                .mandatoryEvidenceSatisfied(missing.isEmpty());
            if (st != null) {
                b.sectionType(sec != null ? sec.getSectionType() : null).sectionTitle(sec != null ? sec.getTitle() : null)
                    .stepCode(st.getStepCode()).title(st.getTitle()).instructionMd(st.getInstructionMd())
                    .commandBlock(st.getCommandBlock()).commandLang(st.getCommandLang()).expectedResult(st.getExpectedResult())
                    .durationEstimateMin(st.getDurationEstimateMin()).assignedRole(st.getAssignedRole())
                    .blocking(st.getIsBlocking()).dualControl(st.getRequiresDualControl()).allowSkip(st.getAllowSkip())
                    .safetyNote(st.getSafetyNote())
                    .evidenceReqs(d.reqs.getOrDefault(st.getStepId(), List.of()).stream().map(q -> StepExecutionDto.ReqStatus.builder()
                        .reqId(q.getReqId()).evidenceType(q.getEvidenceType()).label(q.getLabel()).mandatory(q.getIsMandatory())
                        .satisfied(!missingIds.contains(q.getReqId()) && (Boolean.TRUE.equals(q.getIsMandatory())
                            || raw.stream().anyMatch(i -> q.getReqId().equals(i.getReqId()) || (i.getReqId() == null && q.getEvidenceType().equals(i.getEvidenceType())))))
                        .build()).toList());
            } else if (rbs != null) {
                b.sectionType("ROLLBACK").sectionTitle("Rollback").stepCode("RB-" + (rbs.getSortOrder() + 1))
                    .title(rbs.getTitle()).instructionMd(rbs.getInstructionMd()).commandBlock(rbs.getCommandBlock())
                    .expectedResult(rbs.getVerification()).blocking(false).dualControl(false).allowSkip(true)
                    .safetyNote(rbs.getReversesStepCode() != null ? "Reverses step " + rbs.getReversesStepCode() : null);
            }
            return b.build();
        }).toList();

        Set<Long> acks = new HashSet<>(e.getPreflightAcks());
        List<ExecutionDetailDto.PrereqStatus> prereqs = prerequisites.findByVersionIdOrderBySortOrderAsc(e.getVersionId()).stream()
            .map(p -> ExecutionDetailDto.PrereqStatus.builder().prereqId(p.getPrereqId()).prereqType(p.getPrereqType())
                .label(p.getLabel()).detail(p.getDetail()).mandatory(p.getIsMandatory()).acknowledged(acks.contains(p.getPrereqId())).build())
            .toList();

        List<ClauseDto> clauses = runbookService.clauseDtos(clauseMap.findByRunbookId(rb.getRunbookId()).stream()
            .map(RunbookClauseMap::getClauseId).toList());
        Instant start = e.getStartedAt() != null ? e.getStartedAt() : e.getCreatedAt();
        List<ExecutionDetailDto.Milestone> milestones = new ArrayList<>();
        if (start != null) {
            Set<Integer> seen = new HashSet<>();
            clauses.stream().filter(c -> c.getSlaMinutes() != null)
                .filter(c -> rb.getSlaMinutes() == null || c.getSlaMinutes() <= rb.getSlaMinutes())
                .sorted(Comparator.comparing(ClauseDto::getSlaMinutes))
                .forEach(c -> {
                    if (!seen.add(c.getSlaMinutes())) return;
                    milestones.add(ExecutionDetailDto.Milestone.builder()
                        .label(c.getFrameworkCode() + " " + c.getClauseRef() + " — " + c.getTitle())
                        .dueAt(start.plus(Duration.ofMinutes(c.getSlaMinutes()))).slaMinutes(c.getSlaMinutes())
                        .clauseRef(c.getClauseRef()).frameworkCode(c.getFrameworkCode()).build());
                });
        }
        Instant sla50 = null, sla80 = null;
        if (start != null && e.getDueAt() != null) {
            long secs = Duration.between(start, e.getDueAt()).toSeconds();
            sla50 = start.plusSeconds(secs / 2);
            sla80 = start.plusSeconds(secs * 8 / 10);
        }
        Evidence ev = evidenceCompleteness(e);
        ExecutionSummaryDto s = views.executionSummary(e, rb, v);
        return ExecutionDetailDto.builder()
            .executionId(s.getExecutionId()).executionRef(s.getExecutionRef()).runbookId(s.getRunbookId())
            .runbookCode(s.getRunbookCode()).runbookTitle(s.getRunbookTitle()).criticality(s.getCriticality())
            .versionId(s.getVersionId()).versionNumber(s.getVersionNumber()).triggerType(s.getTriggerType())
            .triggerRefId(s.getTriggerRefId()).operatorUserId(s.getOperatorUserId()).operatorName(s.getOperatorName())
            .status(s.getStatus()).outcome(s.getOutcome()).startedAt(s.getStartedAt()).dueAt(s.getDueAt())
            .completedAt(s.getCompletedAt()).closedAt(s.getClosedAt()).stepsTotal(s.getStepsTotal())
            .stepsPassed(s.getStepsPassed()).stepsFailed(s.getStepsFailed()).stepsSkipped(s.getStepsSkipped())
            .evidenceCount(s.getEvidenceCount()).slaMinutes(s.getSlaMinutes()).overdue(s.getOverdue())
            .findingId(s.getFindingId()).createdAt(s.getCreatedAt())
            .outcomeSummary(e.getOutcomeSummary()).preflightCompletedAt(e.getPreflightCompletedAt())
            .prerequisites(prereqs).steps(steps)
            .escalations(escs.stream().map(x -> ExecutionDetailDto.EscalationRecord.builder()
                .execEscId(x.getExecEscId()).level(x.getLevel()).triggerType(x.getTriggerType()).notifiedRole(x.getNotifiedRole())
                .notifiedUserId(x.getNotifiedUserId()).notifiedName(names.get(x.getNotifiedUserId())).channel(x.getChannel())
                .sentAt(x.getSentAt()).acknowledgedAt(x.getAcknowledgedAt())
                .acknowledgedByName(names.get(x.getAcknowledgedByUserId())).notes(x.getNotes()).build()).toList())
            .signoffs(signs.stream().map(x -> ExecutionDetailDto.SignoffDto.builder().signoffId(x.getSignoffId())
                .signoffRole(x.getSignoffRole()).userId(x.getUserId()).userName(names.get(x.getUserId()))
                .decision(x.getDecision()).comment(x.getComment()).signedAt(x.getSignedAt()).build()).toList())
            .milestones(milestones).sla50At(sla50).sla80At(sla80)
            .evidenceCompleteness(ev.total == 0 ? 100 : (int) Math.round(100.0 * (ev.total - ev.missing) / ev.total))
            .mandatoryEvidenceMissing(ev.missing)
            .clauses(clauses).packAvailable(e.getPackFileId() != null).packHash(e.getPackHash())
            .packFileId(e.getPackFileId()).packGeneratedAt(e.getPackGeneratedAt())
            .linkedControlIds(rb.getLinkedControlIds())
            .build();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
