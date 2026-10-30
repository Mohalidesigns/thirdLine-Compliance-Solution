package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.notifications.service.NotificationService;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.*;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.*;

/**
 * Runbook library: CRUD, clause/obligation/control mapping, the version lifecycle
 * (DRAFT → IN_REVIEW → PUBLISHED, previous PUBLISHED → SUPERSEDED), approvals and JSON
 * export/import. Only drafts are editable; a published version is immutable and hashed.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RunbookService {

    private final RunbookRepository runbooks;
    private final RunbookVersionRepository versions;
    private final RunbookClauseMapRepository clauseMap;
    private final RunbookFrameworkClauseRepository clauses;
    private final RunbookFrameworkRepository frameworks;
    private final RunbookVersionApprovalRepository approvals;
    private final RunbookExecutionRepository executions;
    private final RunbookScheduleRepository schedules;
    private final RunbookReviewScheduleRepository reviewSchedules;
    private final RunbookTreeService tree;
    private final RunbookLintService lint;
    private final RunbookScheduleService scheduleService;
    private final RunbookViews views;
    private final ObligationRepository obligations;
    private final ControlRepository controls;
    private final UserRepository users;
    private final AuditService audit;
    private final NotificationService notifications;
    private final ObjectMapper mapper;

    // ── reads ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<RunbookSummaryDto> list(String q, String category, String status, Integer frameworkId, Integer ownerId,
                                        String criticality, String frequency, Integer dueWithinDays, Boolean needsReview,
                                        Pageable pageable) {
        Page<Runbook> page = runbooks.findAll(RunbookSpecification.withFilters(q, category, status, frameworkId, ownerId,
            criticality, frequency, dueWithinDays, needsReview), pageable);
        Map<Long, RunbookSummaryDto> dto = summaries(page.getContent());
        return page.map(r -> dto.get(r.getRunbookId()));
    }

    /** Batch-built summaries: one query per related table for the whole page. */
    private Map<Long, RunbookSummaryDto> summaries(List<Runbook> rows) {
        if (rows.isEmpty()) return Map.of();
        List<Long> ids = rows.stream().map(Runbook::getRunbookId).toList();
        Map<Long, List<Long>> clauseIdsByRb = clauseMap.findByRunbookIdIn(ids).stream().collect(Collectors.groupingBy(
            RunbookClauseMap::getRunbookId, Collectors.mapping(RunbookClauseMap::getClauseId, Collectors.toList())));
        Set<Long> allClauseIds = clauseIdsByRb.values().stream().flatMap(List::stream).collect(Collectors.toSet());
        Map<Long, Integer> fwByClause = allClauseIds.isEmpty() ? Map.of()
            : clauses.findAllById(allClauseIds).stream().collect(Collectors.toMap(RunbookFrameworkClause::getClauseId, RunbookFrameworkClause::getFrameworkId));
        Map<Integer, String> fwCodes = fwByClause.isEmpty() ? Map.of()
            : frameworks.findAllById(new HashSet<>(fwByClause.values())).stream().collect(Collectors.toMap(RunbookFramework::getFrameworkId, RunbookFramework::getCode));

        Set<Long> versionIds = new HashSet<>();
        rows.forEach(r -> { if (r.getCurrentVersionId() != null) versionIds.add(r.getCurrentVersionId()); });
        Map<Long, RunbookVersion> current = versions.findAllById(versionIds).stream().collect(Collectors.toMap(RunbookVersion::getVersionId, Function.identity()));
        Map<Long, RunbookVersion> openDraft = new HashMap<>();
        versions.findByRunbookIdInAndStatusIn(ids, OPEN_VERSION_STATUSES).forEach(v ->
            openDraft.merge(v.getRunbookId(), v, (a, b) -> a.getVersionNumber() >= b.getVersionNumber() ? a : b));

        Map<Long, RunbookExecution> lastExec = new HashMap<>();
        executions.findByRunbookIdIn(ids).forEach(e -> lastExec.merge(e.getRunbookId(), e,
            (a, b) -> a.getCreatedAt() != null && b.getCreatedAt() != null && a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b));
        Map<Long, LocalDate> nextRun = new HashMap<>();
        schedules.findByRunbookIdInAndIsActiveTrue(ids).forEach(s -> {
            if (s.getNextRunAt() != null) nextRun.merge(s.getRunbookId(), s.getNextRunAt(), (a, b) -> a.isBefore(b) ? a : b);
        });
        Map<Long, LocalDate> nextReview = reviewSchedules.findByRunbookIdIn(ids).stream()
            .collect(Collectors.toMap(RunbookReviewSchedule::getRunbookId, RunbookReviewSchedule::getNextReviewAt, (a, b) -> a));

        LocalDate today = LocalDate.now();
        Map<Long, RunbookSummaryDto> out = new HashMap<>();
        for (Runbook r : rows) {
            List<Long> cids = clauseIdsByRb.getOrDefault(r.getRunbookId(), List.of());
            List<String> codes = cids.stream().map(fwByClause::get).filter(Objects::nonNull).map(fwCodes::get)
                .filter(Objects::nonNull).distinct().sorted().toList();
            RunbookVersion cv = current.get(r.getCurrentVersionId());
            RunbookVersion dv = openDraft.get(r.getRunbookId());
            RunbookExecution le = lastExec.get(r.getRunbookId());
            LocalDate review = nextReview.get(r.getRunbookId());
            out.put(r.getRunbookId(), RunbookSummaryDto.builder()
                .runbookId(r.getRunbookId()).runbookCode(r.getRunbookCode()).title(r.getTitle()).category(r.getCategory())
                .criticality(r.getCriticality()).frequency(r.getFrequency()).status(r.getStatus())
                .ownerUserId(r.getOwnerUserId()).ownerName(r.getOwnerName()).slaMinutes(r.getSlaMinutes())
                .currentVersionNumber(cv != null ? cv.getVersionNumber() : null)
                .draftVersionId(dv != null ? dv.getVersionId() : null).draftVersionStatus(dv != null ? dv.getStatus() : null)
                .clauseCount(cids.size()).frameworkCodes(new ArrayList<>(codes))
                .linkedObligationCount(r.getLinkedObligationIds().size()).linkedControlCount(r.getLinkedControlIds().size())
                .lastExecutionStatus(le != null ? le.getStatus() : null).lastExecutionAt(le != null ? le.getCreatedAt() : null)
                .nextRunAt(nextRun.get(r.getRunbookId())).nextReviewAt(review)
                .needsReview(review != null && !review.isAfter(today))
                .sourceTemplateCode(r.getSourceTemplateCode()).updatedAt(r.getUpdatedAt())
                .build());
        }
        return out;
    }

    @Transactional(readOnly = true)
    public RunbookStatsDto stats() {
        List<Runbook> all = runbooks.findAll();
        LocalDate today = LocalDate.now();
        Map<String, Long> byStatus = all.stream().collect(Collectors.groupingBy(Runbook::getStatus, TreeMap::new, Collectors.counting()));
        List<Runbook> live = all.stream().filter(r -> !RB_ARCHIVED.equals(r.getStatus())).toList();
        Set<Long> liveIds = live.stream().map(Runbook::getRunbookId).collect(Collectors.toSet());
        long due30 = schedules.findByIsActiveTrueAndNextRunAtBetweenOrderByNextRunAtAsc(today, today.plusDays(30)).stream()
            .map(RunbookSchedule::getRunbookId).filter(liveIds::contains).distinct().count();
        long overdueReviews = reviewSchedules.findByNextReviewAtLessThanEqual(today).stream()
            .map(RunbookReviewSchedule::getRunbookId).filter(liveIds::contains).count();
        Map<Long, RunbookExecution> last = new HashMap<>();
        executions.findByRunbookIdIn(liveIds).stream().filter(e -> e.getClosedAt() != null)
            .forEach(e -> last.merge(e.getRunbookId(), e, (a, b) -> a.getClosedAt().isAfter(b.getClosedAt()) ? a : b));
        long failedLast = last.values().stream().filter(e -> EX_COMPLETED_FAIL.equals(e.getStatus())).count();
        return RunbookStatsDto.builder()
            .total((long) live.size())
            .published(byStatus.getOrDefault(RB_PUBLISHED, 0L)).draft(byStatus.getOrDefault(RB_DRAFT, 0L))
            .inReview(byStatus.getOrDefault(RB_IN_REVIEW, 0L)).deprecated(byStatus.getOrDefault(RB_DEPRECATED, 0L))
            .dueIn30Days(due30).overdueReviews(overdueReviews).failedLastRun(failedLast)
            .activeExecutions(executions.countByStatusIn(ACTIVE_EXECUTION_STATUSES))
            .byStatus(byStatus)
            .byCategory(live.stream().collect(Collectors.groupingBy(Runbook::getCategory, TreeMap::new, Collectors.counting())))
            .byCriticality(live.stream().collect(Collectors.groupingBy(Runbook::getCriticality, TreeMap::new, Collectors.counting())))
            .build();
    }

    @Transactional(readOnly = true)
    public RunbookDetailDto detail(Long id) {
        return detail(find(id), null);
    }

    /** Full detail; {@code latestTemplateVersion} (from the platform) flags a template update when known. */
    @Transactional(readOnly = true)
    public RunbookDetailDto detail(Runbook r, Integer latestTemplateVersion) {
        RunbookSummaryDto s = summaries(List.of(r)).get(r.getRunbookId());
        List<Long> clauseIds = clauseIds(r.getRunbookId());
        RunbookVersion cv = r.getCurrentVersionId() != null ? versions.findById(r.getCurrentVersionId()).orElse(null) : null;

        List<RunbookDetailDto.LinkedObligation> obls = r.getLinkedObligationIds().isEmpty() ? List.of()
            : obligations.findAllById(r.getLinkedObligationIds()).stream().map(o -> RunbookDetailDto.LinkedObligation.builder()
                .obligationId(o.getObligationId()).title(o.getTitle() != null ? o.getTitle() : o.getName())
                .sectionReference(o.getSectionReference()).build()).toList();
        List<Integer> ctlIds = r.getLinkedControlIds().stream().map(Long::intValue).toList();
        List<RunbookDetailDto.LinkedControl> ctls = ctlIds.isEmpty() ? List.of()
            : controls.findAllById(ctlIds).stream().map(c -> RunbookDetailDto.LinkedControl.builder()
                .controlId(c.getControlId()).controlNumber(c.getControlNumber()).name(c.getName()).build()).toList();

        return RunbookDetailDto.builder()
            .runbookId(r.getRunbookId()).runbookCode(r.getRunbookCode()).title(r.getTitle()).category(r.getCategory())
            .criticality(r.getCriticality()).frequency(r.getFrequency()).status(r.getStatus()).statusReason(r.getStatusReason())
            .ownerUserId(r.getOwnerUserId()).ownerName(r.getOwnerName()).slaMinutes(r.getSlaMinutes())
            .currentVersionNumber(s.getCurrentVersionNumber()).currentVersionId(r.getCurrentVersionId())
            .draftVersionId(s.getDraftVersionId()).draftVersionStatus(s.getDraftVersionStatus())
            .clauseCount(s.getClauseCount()).frameworkCodes(s.getFrameworkCodes())
            .linkedObligationCount(s.getLinkedObligationCount()).linkedControlCount(s.getLinkedControlCount())
            .lastExecutionStatus(s.getLastExecutionStatus()).lastExecutionAt(s.getLastExecutionAt())
            .nextRunAt(s.getNextRunAt()).nextReviewAt(s.getNextReviewAt()).needsReview(s.getNeedsReview())
            .sourceTemplateCode(r.getSourceTemplateCode()).sourceTemplateVersion(r.getSourceTemplateVer())
            .latestTemplateVersion(latestTemplateVersion)
            .templateUpdateAvailable(latestTemplateVersion != null && r.getSourceTemplateVer() != null
                && latestTemplateVersion > r.getSourceTemplateVer())
            .objective(r.getObjective()).scopeSystems(r.getScopeSystems()).scopeTeams(r.getScopeTeams()).tags(r.getTags())
            .reviewCadence(r.getReviewCadence())
            .linkedObligationIds(r.getLinkedObligationIds()).linkedControlIds(r.getLinkedControlIds())
            .linkedObligations(obls).linkedControls(ctls)
            .clauses(clauseDtos(clauseIds))
            .currentVersion(cv != null ? tree.load(cv) : null)
            .schedules(scheduleService.list(r.getRunbookId()))
            .recentExecutions(views.executionSummaries(executions.findTop5ByRunbookIdOrderByCreatedAtDesc(r.getRunbookId())))
            .createdAt(r.getCreatedAt()).updatedAt(r.getUpdatedAt())
            .build();
    }

    public List<ClauseDto> clauseDtos(Collection<Long> ids) {
        if (ids.isEmpty()) return List.of();
        List<RunbookFrameworkClause> rows = clauses.findAllById(ids);
        Map<Integer, String> fw = frameworks.findAllById(rows.stream().map(RunbookFrameworkClause::getFrameworkId).collect(Collectors.toSet()))
            .stream().collect(Collectors.toMap(RunbookFramework::getFrameworkId, RunbookFramework::getCode));
        return rows.stream().map(c -> ClauseDto.builder().clauseId(c.getClauseId()).frameworkId(c.getFrameworkId())
                .frameworkCode(fw.get(c.getFrameworkId())).clauseRef(c.getClauseRef()).title(c.getTitle())
                .requirementText(c.getRequirementText()).domain(c.getDomain()).deadlineRule(c.getDeadlineRule())
                .slaMinutes(c.getSlaMinutes()).build())
            .sorted(Comparator.comparing(ClauseDto::getFrameworkCode, Comparator.nullsLast(String::compareTo))
                .thenComparing(ClauseDto::getClauseRef))
            .toList();
    }

    public List<Long> clauseIds(Long runbookId) {
        return clauseMap.findByRunbookId(runbookId).stream().map(RunbookClauseMap::getClauseId).toList();
    }

    public Runbook find(Long id) {
        return runbooks.findById(id).orElseThrow(() -> ApiException.notFound("Runbook not found: " + id));
    }

    // ── create / update ─────────────────────────────────────────────────────

    @Transactional
    public RunbookDetailDto create(CreateRunbookRequest req, User user) {
        Runbook rb = createEntity(req.getTitle(), req.getCategory(), req.getCriticality(), req.getOwnerUserId(),
            req.getFrequency(), req.getSlaMinutes(), req.getObjective(), null, user);
        audit.log(user.getUserId(), "runbook_created", SUBJECT_RUNBOOK, rb.getRunbookId(),
            Map.of("code", rb.getRunbookCode(), "title", rb.getTitle()));
        return detail(rb, null);
    }

    /** Creates the runbook row and its empty DRAFT v1; validation shared by create, import and adopt. */
    @Transactional
    public Runbook createEntity(String title, String category, String criticality, Integer ownerUserId, String frequency,
                               Integer slaMinutes, String objective, String preferredCode, User user) {
        if (title == null || title.trim().length() < 5) throw ApiException.badRequest("Title must be at least 5 characters");
        if (category == null || !CATEGORIES.contains(category)) throw ApiException.badRequest("Invalid category: " + category);
        String crit = criticality != null ? criticality : "MEDIUM";
        if (!CRITICALITIES.contains(crit)) throw ApiException.badRequest("Invalid criticality: " + criticality);
        if (frequency != null && !FREQUENCIES.contains(frequency)) throw ApiException.badRequest("Invalid frequency: " + frequency);
        if (slaMinutes != null && slaMinutes <= 0) throw ApiException.badRequest("SLA minutes must be positive");
        User owner = resolveOwner(ownerUserId != null ? ownerUserId : user.getUserId());
        Runbook rb = runbooks.save(Runbook.builder()
            .runbookCode(preferredCode != null && !runbooks.existsByRunbookCode(preferredCode) ? preferredCode : nextCode(category))
            .title(title.trim()).category(category).criticality(crit).frequency(frequency).slaMinutes(slaMinutes)
            .objective(RunbookTreeService.blankToNull(objective))
            .ownerUserId(owner.getUserId()).ownerName(owner.getFullName())
            .status(RB_DRAFT).createdByUserId(user.getUserId()).build());
        versions.save(RunbookVersion.builder().runbookId(rb.getRunbookId()).versionNumber(1)
            .status(V_DRAFT).authoredByUserId(user.getUserId()).build());
        return rb;
    }

    private String nextCode(String category) {
        String prefix = "RB-" + codePrefix(category) + "-";
        int max = runbooks.findByRunbookCodeStartingWith(prefix).stream().mapToInt(r -> {
            try { return Integer.parseInt(r.getRunbookCode().substring(prefix.length())); } catch (Exception e) { return 0; }
        }).max().orElse(0);
        return prefix + String.format("%03d", max + 1);
    }

    private User resolveOwner(Integer userId) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.badRequest("Owner user not found: " + userId));
        if (Boolean.FALSE.equals(u.getIsActive())) throw ApiException.badRequest("Owner must be an active user");
        return u;
    }

    @Transactional
    public RunbookDetailDto update(Long id, UpdateRunbookRequest req, User user) {
        Runbook rb = find(id);
        requireEditable(rb);
        Map<String, Object> before = Map.of("title", rb.getTitle(), "criticality", rb.getCriticality(),
            "category", rb.getCategory(), "owner", String.valueOf(rb.getOwnerUserId()));
        if (req.getTitle() != null) {
            if (req.getTitle().trim().length() < 5) throw ApiException.badRequest("Title must be at least 5 characters");
            rb.setTitle(req.getTitle().trim());
        }
        if (req.getCategory() != null) {
            if (!CATEGORIES.contains(req.getCategory())) throw ApiException.badRequest("Invalid category");
            rb.setCategory(req.getCategory());
        }
        if (req.getCriticality() != null) {
            if (!CRITICALITIES.contains(req.getCriticality())) throw ApiException.badRequest("Invalid criticality");
            rb.setCriticality(req.getCriticality());
        }
        if (req.getFrequency() != null) {
            if (!FREQUENCIES.contains(req.getFrequency())) throw ApiException.badRequest("Invalid frequency");
            rb.setFrequency(req.getFrequency());
        }
        if (req.getOwnerUserId() != null && !req.getOwnerUserId().equals(rb.getOwnerUserId())) {
            User owner = resolveOwner(req.getOwnerUserId());
            rb.setOwnerUserId(owner.getUserId());
            rb.setOwnerName(owner.getFullName());
        }
        if (req.getSlaMinutes() != null) rb.setSlaMinutes(req.getSlaMinutes() > 0 ? req.getSlaMinutes() : null);
        if (req.getObjective() != null) rb.setObjective(RunbookTreeService.blankToNull(req.getObjective()));
        if (req.getScopeSystems() != null) rb.setScopeSystems(cleanList(req.getScopeSystems()));
        if (req.getScopeTeams() != null) rb.setScopeTeams(cleanList(req.getScopeTeams()));
        if (req.getTags() != null) rb.setTags(cleanList(req.getTags()));
        boolean cadenceChanged = false;
        if (req.getReviewCadence() != null) {
            if (!REVIEW_CADENCES.contains(req.getReviewCadence())) throw ApiException.badRequest("Invalid review cadence");
            cadenceChanged = !req.getReviewCadence().equals(rb.getReviewCadence());
            rb.setReviewCadence(req.getReviewCadence());
        }
        runbooks.save(rb);
        if (cadenceChanged && rb.getCurrentVersionId() != null) scheduleService.scheduleReview(rb, LocalDate.now());
        audit.log(user.getUserId(), "runbook_updated", SUBJECT_RUNBOOK, id, before,
            Map.of("title", rb.getTitle(), "criticality", rb.getCriticality(), "category", rb.getCategory(),
                "owner", String.valueOf(rb.getOwnerUserId())), null);
        return detail(rb, null);
    }

    private static List<String> cleanList(List<String> in) {
        return in.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).distinct()
            .collect(Collectors.toCollection(ArrayList::new));
    }

    private void requireEditable(Runbook rb) {
        if (RB_ARCHIVED.equals(rb.getStatus())) throw ApiException.conflict("Archived runbooks cannot be changed");
    }

    @Transactional
    public void delete(Long id, User user) {
        Runbook rb = find(id);
        if (!RB_DRAFT.equals(rb.getStatus()) || rb.getCurrentVersionId() != null) {
            throw ApiException.conflict("Only never-published draft runbooks can be deleted — deprecate or archive it instead");
        }
        if (executions.countByRunbookId(id) > 0) throw ApiException.conflict("The runbook has executions and cannot be deleted");
        for (RunbookVersion v : versions.findByRunbookIdOrderByVersionNumberDesc(id)) {
            approvals.deleteByVersionId(v.getVersionId());
            tree.replace(v.getVersionId(), SaveVersionRequest.builder().build());
            versions.delete(v);
        }
        runbooks.delete(rb);
        audit.log(user.getUserId(), "runbook_deleted", SUBJECT_RUNBOOK, id, Map.of("code", rb.getRunbookCode()));
    }

    @Transactional
    public RunbookDetailDto clone(Long id, String title, User user) {
        Runbook src = find(id);
        RunbookVersion from = src.getCurrentVersionId() != null ? versions.findById(src.getCurrentVersionId()).orElse(null)
            : versions.findFirstByRunbookIdOrderByVersionNumberDesc(id).orElse(null);
        Runbook copy = createEntity(title != null && !title.isBlank() ? title : src.getTitle() + " (copy)", src.getCategory(),
            src.getCriticality(), user.getUserId(), src.getFrequency(), src.getSlaMinutes(), src.getObjective(), null, user);
        copy.setScopeSystems(new ArrayList<>(src.getScopeSystems()));
        copy.setScopeTeams(new ArrayList<>(src.getScopeTeams()));
        copy.setTags(new ArrayList<>(src.getTags()));
        copy.setReviewCadence(src.getReviewCadence());
        copy.setLinkedObligationIds(new ArrayList<>(src.getLinkedObligationIds()));
        copy.setLinkedControlIds(new ArrayList<>(src.getLinkedControlIds()));
        runbooks.save(copy);
        for (Long cid : clauseIds(id)) clauseMap.save(RunbookClauseMap.builder().runbookId(copy.getRunbookId()).clauseId(cid).build());
        if (from != null) {
            RunbookVersion draft = versions.findFirstByRunbookIdOrderByVersionNumberDesc(copy.getRunbookId()).orElseThrow();
            tree.copy(from, draft.getVersionId());
        }
        audit.log(user.getUserId(), "runbook_cloned", SUBJECT_RUNBOOK, copy.getRunbookId(),
            Map.of("from", src.getRunbookCode(), "code", copy.getRunbookCode()));
        return detail(copy, null);
    }

    @Transactional
    public RunbookDetailDto setLifecycle(Long id, String target, String reason, User user) {
        Runbook rb = find(id);
        if (reason == null || reason.trim().length() < 5) throw ApiException.badRequest("Give a reason (at least 5 characters)");
        if (RB_DEPRECATED.equals(target) && !RB_PUBLISHED.equals(rb.getStatus())) {
            throw ApiException.conflict("Only published runbooks can be deprecated");
        }
        if (RB_ARCHIVED.equals(target) && RB_ARCHIVED.equals(rb.getStatus())) throw ApiException.conflict("Already archived");
        String before = rb.getStatus();
        rb.setStatus(target);
        rb.setStatusReason(reason.trim());
        runbooks.save(rb);
        schedules.findByRunbookIdOrderByScheduleIdAsc(id).forEach(s -> { s.setIsActive(false); schedules.save(s); });
        audit.log(user.getUserId(), "runbook_" + target.toLowerCase(), SUBJECT_RUNBOOK, id,
            Map.of("from", before, "reason", reason.trim()));
        return detail(rb, null);
    }

    @Transactional
    public RunbookDetailDto setClauses(Long id, List<Long> clauseIds, User user) {
        Runbook rb = find(id);
        requireEditable(rb);
        Set<Long> ids = new LinkedHashSet<>(clauseIds != null ? clauseIds : List.of());
        if (!ids.isEmpty() && clauses.findAllById(ids).size() != ids.size()) throw ApiException.badRequest("Unknown clause id");
        clauseMap.deleteByRunbookId(id);
        clauseMap.flush();
        ids.forEach(cid -> clauseMap.save(RunbookClauseMap.builder().runbookId(id).clauseId(cid).build()));
        rb.setUpdatedAt(Instant.now());
        runbooks.save(rb);
        audit.log(user.getUserId(), "runbook_clauses_mapped", SUBJECT_RUNBOOK, id, Map.of("clauseIds", new ArrayList<>(ids)));
        return detail(rb, null);
    }

    @Transactional
    public RunbookDetailDto setLinks(Long id, LinksRequest req, User user) {
        Runbook rb = find(id);
        requireEditable(rb);
        List<Long> obl = new ArrayList<>(new LinkedHashSet<>(req.getObligationIds()));
        List<Long> ctl = new ArrayList<>(new LinkedHashSet<>(req.getControlIds()));
        if (!obl.isEmpty() && obligations.findAllById(obl).size() != obl.size()) throw ApiException.badRequest("Unknown obligation id");
        if (!ctl.isEmpty() && controls.findAllById(ctl.stream().map(Long::intValue).toList()).size() != ctl.size()) {
            throw ApiException.badRequest("Unknown control id");
        }
        rb.setLinkedObligationIds(obl);
        rb.setLinkedControlIds(ctl);
        runbooks.save(rb);
        audit.log(user.getUserId(), "runbook_links_updated", SUBJECT_RUNBOOK, id, Map.of("obligationIds", obl, "controlIds", ctl));
        return detail(rb, null);
    }

    // ── versions ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<RunbookVersionSummaryDto> versions(Long runbookId) {
        find(runbookId);
        List<RunbookVersion> rows = versions.findByRunbookIdOrderByVersionNumberDesc(runbookId);
        Set<Integer> uids = new HashSet<>();
        rows.forEach(v -> { uids.add(v.getAuthoredByUserId()); uids.add(v.getApprovedByUserId()); });
        Map<Integer, String> names = tree.userNames(uids);
        return rows.stream().map(v -> RunbookVersionSummaryDto.builder()
            .versionId(v.getVersionId()).versionNumber(v.getVersionNumber()).status(v.getStatus())
            .changeSummary(v.getChangeSummary()).contentHash(v.getContentHash())
            .authoredByUserId(v.getAuthoredByUserId()).authoredByName(names.get(v.getAuthoredByUserId()))
            .approvedByName(names.get(v.getApprovedByUserId())).approvedAt(v.getApprovedAt())
            .publishedAt(v.getPublishedAt()).createdAt(v.getCreatedAt())
            .stepCount(tree.stepCount(tree.load(v))).build()).toList();
    }

    public RunbookVersion findVersion(Long runbookId, Long versionId) {
        return versions.findByVersionIdAndRunbookId(versionId, runbookId)
            .orElseThrow(() -> ApiException.notFound("Version " + versionId + " not found on runbook " + runbookId));
    }

    @Transactional(readOnly = true)
    public RunbookVersionTreeDto version(Long runbookId, Long versionId) {
        return tree.load(findVersion(runbookId, versionId));
    }

    @Transactional
    public RunbookVersionTreeDto createDraft(Long runbookId, User user) {
        Runbook rb = find(runbookId);
        requireEditable(rb);
        versions.findFirstByRunbookIdAndStatusInOrderByVersionNumberDesc(runbookId, OPEN_VERSION_STATUSES).ifPresent(v -> {
            throw ApiException.conflict("open_draft_exists", "Version " + v.getVersionNumber() + " is already open (" + v.getStatus() + ")");
        });
        int next = versions.findFirstByRunbookIdOrderByVersionNumberDesc(runbookId).map(v -> v.getVersionNumber() + 1).orElse(1);
        RunbookVersion draft = versions.save(RunbookVersion.builder().runbookId(runbookId).versionNumber(next)
            .status(V_DRAFT).authoredByUserId(user.getUserId()).build());
        if (rb.getCurrentVersionId() != null) {
            versions.findById(rb.getCurrentVersionId()).ifPresent(cur -> tree.copy(cur, draft.getVersionId()));
        }
        audit.log(user.getUserId(), "runbook_draft_created", SUBJECT_RUNBOOK, runbookId, Map.of("version", next));
        return tree.load(draft);
    }

    @Transactional
    public SaveVersionResponse save(Long runbookId, Long versionId, SaveVersionRequest req, User user) {
        Runbook rb = find(runbookId);
        requireEditable(rb);
        RunbookVersion v = findVersion(runbookId, versionId);
        if (!V_DRAFT.equals(v.getStatus())) throw ApiException.conflict("Only DRAFT versions can be edited (this one is " + v.getStatus() + ")");
        lint.validateTree(req);
        Set<Long> stepClauseIds = new HashSet<>();
        req.getSections().forEach(s -> s.getSteps().forEach(st -> stepClauseIds.addAll(st.getClauseIds())));
        if (!stepClauseIds.isEmpty() && clauses.findAllById(stepClauseIds).size() != stepClauseIds.size()) {
            throw ApiException.badRequest("Unknown clause id on a step");
        }
        tree.replace(versionId, req);
        rb.setUpdatedAt(Instant.now());
        runbooks.save(rb);
        RunbookVersionTreeDto saved = tree.load(v);
        return SaveVersionResponse.builder().version(saved).lint(lintTree(rb, saved)).build();
    }

    @Transactional(readOnly = true)
    public LintReportDto lint(Long runbookId, Long versionId) {
        Runbook rb = find(runbookId);
        return lintTree(rb, tree.load(findVersion(runbookId, versionId)));
    }

    private LintReportDto lintTree(Runbook rb, RunbookVersionTreeDto t) {
        return lint.lint(rb, tree.toSaveRequest(t), clauseIds(rb.getRunbookId()).size());
    }

    @Transactional(readOnly = true)
    public VersionDiffDto diff(Long runbookId, Long versionId, Long otherVersionId) {
        RunbookVersionTreeDto a = tree.load(findVersion(runbookId, otherVersionId));
        RunbookVersionTreeDto b = tree.load(findVersion(runbookId, versionId));
        return a.getVersionNumber() <= b.getVersionNumber() ? tree.diff(a, b) : tree.diff(b, a);
    }

    @Transactional
    public RunbookVersionTreeDto submit(Long runbookId, Long versionId, User user) {
        Runbook rb = find(runbookId);
        RunbookVersion v = findVersion(runbookId, versionId);
        if (!V_DRAFT.equals(v.getStatus())) throw ApiException.conflict("Only a DRAFT can be submitted for approval");
        requireLintClean(rb, v);
        v.setStatus(V_IN_REVIEW);
        v.setSubmittedAt(Instant.now());
        versions.save(v);
        if (rb.getCurrentVersionId() == null) {
            rb.setStatus(RB_IN_REVIEW);
            runbooks.save(rb);
        }
        audit.log(user.getUserId(), "runbook_submitted", SUBJECT_RUNBOOK, runbookId, Map.of("version", v.getVersionNumber()));
        String summary = "Runbook " + rb.getRunbookCode() + " v" + v.getVersionNumber() + " (" + rb.getTitle()
            + ") is waiting for your approval";
        String subject = "Approval needed: runbook " + rb.getRunbookCode() + " v" + v.getVersionNumber();
        // Approvers are CCO and TENANT_ADMIN (RunbookRoles.APPROVERS); the author can't approve their own version.
        for (String role : List.of(AppRole.CCO, AppRole.TENANT_ADMIN)) {
            notifications.notifyRoleEmailed(role, NOTIFICATION_CATEGORY, NotificationConstants.SEVERITY_MEDIUM,
                summary, "/runbooks/approvals", subject, user.getUserId());
        }
        return tree.load(v);
    }

    @Transactional
    public RunbookVersionTreeDto approve(Long runbookId, Long versionId, VersionDecisionRequest req, User user) {
        Runbook rb = find(runbookId);
        RunbookVersion v = findVersion(runbookId, versionId);
        if (!V_IN_REVIEW.equals(v.getStatus())) throw ApiException.conflict("Only a version in review can be approved");
        if (user.getUserId().equals(v.getAuthoredByUserId())) {
            throw ApiException.conflict("self_approval", "The author of a version cannot approve it");
        }
        approvals.save(RunbookVersionApproval.builder().versionId(versionId).approverUserId(user.getUserId())
            .approverRole(user.getRole()).decision(APPROVAL_APPROVED).comment(RunbookTreeService.blankToNull(req.getComment())).build());
        v.setApprovedByUserId(user.getUserId());
        v.setApprovedAt(Instant.now());
        versions.save(v);
        audit.log(user.getUserId(), "runbook_version_approved", SUBJECT_RUNBOOK, runbookId, Map.of("version", v.getVersionNumber()));
        String summary = req.getChangeSummary() != null && !req.getChangeSummary().isBlank() ? req.getChangeSummary() : v.getChangeSummary();
        return publishInternal(rb, v, summary, user);
    }

    @Transactional
    public RunbookVersionTreeDto reject(Long runbookId, Long versionId, VersionDecisionRequest req, User user) {
        Runbook rb = find(runbookId);
        RunbookVersion v = findVersion(runbookId, versionId);
        if (!V_IN_REVIEW.equals(v.getStatus())) throw ApiException.conflict("Only a version in review can be rejected");
        String decision = APPROVAL_REJECTED.equals(req.getDecision()) ? APPROVAL_REJECTED : APPROVAL_CHANGES_REQUESTED;
        if (req.getComment() == null || req.getComment().isBlank()) throw ApiException.badRequest("Say why the version is rejected");
        approvals.save(RunbookVersionApproval.builder().versionId(versionId).approverUserId(user.getUserId())
            .approverRole(user.getRole()).decision(decision).comment(req.getComment().trim()).build());
        v.setStatus(V_DRAFT);
        v.setSubmittedAt(null);
        versions.save(v);
        if (rb.getCurrentVersionId() == null) {
            rb.setStatus(RB_DRAFT);
            runbooks.save(rb);
        }
        audit.log(user.getUserId(), "runbook_version_rejected", SUBJECT_RUNBOOK, runbookId,
            Map.of("version", v.getVersionNumber(), "decision", decision));
        return tree.load(v);
    }

    @Transactional
    public RunbookVersionTreeDto publish(Long runbookId, Long versionId, String changeSummary, User user) {
        Runbook rb = find(runbookId);
        RunbookVersion v = findVersion(runbookId, versionId);
        if (requiresApproval(rb.getCriticality())) {
            throw ApiException.conflict("approval_required",
                rb.getCriticality() + " runbooks must be submitted and approved by a second person before publishing");
        }
        if (!V_DRAFT.equals(v.getStatus()) && !V_IN_REVIEW.equals(v.getStatus())) {
            throw ApiException.conflict("Only a draft or in-review version can be published");
        }
        return publishInternal(rb, v, changeSummary, user);
    }

    private RunbookVersionTreeDto publishInternal(Runbook rb, RunbookVersion v, String changeSummary, User user) {
        if (changeSummary == null || changeSummary.trim().length() < 10) {
            throw ApiException.badRequest("The change summary must be at least 10 characters");
        }
        requireLintClean(rb, v);
        if (RB_ARCHIVED.equals(rb.getStatus())) throw ApiException.conflict("Archived runbooks cannot be published");
        versions.findByRunbookIdAndStatus(rb.getRunbookId(), V_PUBLISHED).forEach(p -> {
            p.setStatus(V_SUPERSEDED);
            versions.save(p);
        });
        RunbookVersionTreeDto t = tree.load(v);
        v.setContentHash(tree.contentHash(rb, t, clauseIds(rb.getRunbookId())));
        v.setChangeSummary(changeSummary.trim());
        v.setStatus(V_PUBLISHED);
        v.setPublishedAt(Instant.now());
        versions.save(v);
        rb.setCurrentVersionId(v.getVersionId());
        rb.setStatus(RB_PUBLISHED);
        rb.setStatusReason(null);
        runbooks.save(rb);
        scheduleService.scheduleReview(rb, LocalDate.now());
        audit.log(user.getUserId(), "runbook_published", SUBJECT_RUNBOOK, rb.getRunbookId(),
            Map.of("version", v.getVersionNumber(), "contentHash", v.getContentHash()));
        return tree.load(v);
    }

    private void requireLintClean(Runbook rb, RunbookVersion v) {
        LintReportDto report = lintTree(rb, tree.load(v));
        if (report.getErrors() > 0) {
            String first = report.getIssues().stream().filter(i -> "ERROR".equals(i.getSeverity()))
                .map(i -> i.getRule() + (i.getStepCode() != null ? " (step " + i.getStepCode() + ")" : "") + ": " + i.getMessage())
                .findFirst().orElse("");
            throw ApiException.conflict("lint_errors", report.getErrors() + " lint error(s) must be fixed first — " + first);
        }
    }

    @Transactional(readOnly = true)
    public List<ApprovalQueueItemDto> pendingApprovals() {
        List<RunbookVersion> pending = versions.findByStatusOrderBySubmittedAtAsc(V_IN_REVIEW);
        if (pending.isEmpty()) return List.of();
        Map<Long, Runbook> rbs = runbooks.findAllById(pending.stream().map(RunbookVersion::getRunbookId).collect(Collectors.toSet()))
            .stream().collect(Collectors.toMap(Runbook::getRunbookId, Function.identity()));
        Map<Long, RunbookVersion> current = versions.findAllById(rbs.values().stream().map(Runbook::getCurrentVersionId)
            .filter(Objects::nonNull).toList()).stream().collect(Collectors.toMap(RunbookVersion::getVersionId, Function.identity()));
        Map<Integer, String> names = tree.userNames(pending.stream().map(RunbookVersion::getAuthoredByUserId).toList());
        return pending.stream().filter(v -> rbs.containsKey(v.getRunbookId())).map(v -> {
            Runbook rb = rbs.get(v.getRunbookId());
            RunbookVersion cur = current.get(rb.getCurrentVersionId());
            return ApprovalQueueItemDto.builder().runbookId(rb.getRunbookId()).runbookCode(rb.getRunbookCode())
                .title(rb.getTitle()).criticality(rb.getCriticality()).category(rb.getCategory())
                .versionId(v.getVersionId()).versionNumber(v.getVersionNumber()).changeSummary(v.getChangeSummary())
                .authoredByUserId(v.getAuthoredByUserId()).authoredByName(names.get(v.getAuthoredByUserId()))
                .submittedAt(v.getSubmittedAt())
                .publishedVersionId(cur != null ? cur.getVersionId() : null)
                .publishedVersionNumber(cur != null ? cur.getVersionNumber() : null).build();
        }).toList();
    }

    // ── export / import ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public byte[] exportJson(Long id, User user) {
        Runbook rb = find(id);
        RunbookVersion v = rb.getCurrentVersionId() != null ? versions.findById(rb.getCurrentVersionId()).orElseThrow()
            : versions.findFirstByRunbookIdOrderByVersionNumberDesc(id).orElseThrow();
        try {
            byte[] out = mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(tree.toPortable(rb, tree.load(v), clauseIds(id)));
            audit.log(user.getUserId(), "runbook_exported", SUBJECT_RUNBOOK, id, Map.of("version", v.getVersionNumber()));
            return out;
        } catch (Exception e) {
            throw new IllegalStateException("Runbook export failed", e);
        }
    }

    @Transactional
    public RunbookDetailDto importJson(MultipartFile file, User user) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("empty_file", "The uploaded file is empty");
        if (file.getSize() > 2_000_000) throw ApiException.badRequest("The runbook file is larger than 2 MB");
        Map<String, Object> m;
        try {
            m = mapper.readValue(file.getBytes(), new TypeReference<>() {});
        } catch (Exception e) {
            throw ApiException.badRequest("invalid_runbook_format", "The file is not valid JSON");
        }
        Runbook rb = createFromPortable(m, null, user);
        audit.log(user.getUserId(), "runbook_imported", SUBJECT_RUNBOOK, rb.getRunbookId(),
            Map.of("code", rb.getRunbookCode(), "file", String.valueOf(file.getOriginalFilename())));
        return detail(rb, null);
    }

    /** Creates a runbook (DRAFT v1 holding the content) from a portable document. */
    @Transactional
    public Runbook createFromPortable(Map<String, Object> m, Integer ownerUserId, User user) {
        RunbookTreeService.PortableRunbook p = tree.fromPortable(m);
        lint.validateTree(p.tree());
        Runbook rb = createEntity(str(m.get("title")), str(m.get("category")), str(m.get("criticality")), ownerUserId,
            str(m.get("frequency")), m.get("slaMinutes") instanceof Number n ? n.intValue() : null,
            str(m.get("objective")), str(m.get("runbookCode")), user);
        rb.setScopeSystems(strings(m.get("scopeSystems")));
        rb.setScopeTeams(strings(m.get("scopeTeams")));
        rb.setTags(strings(m.get("tags")));
        String cadence = str(m.get("reviewCadence"));
        if (cadence != null && REVIEW_CADENCES.contains(cadence)) rb.setReviewCadence(cadence);
        runbooks.save(rb);
        new LinkedHashSet<>(p.clauseIds()).forEach(cid -> clauseMap.save(RunbookClauseMap.builder().runbookId(rb.getRunbookId()).clauseId(cid).build()));
        RunbookVersion draft = versions.findFirstByRunbookIdOrderByVersionNumberDesc(rb.getRunbookId()).orElseThrow();
        tree.replace(draft.getVersionId(), p.tree());
        if (!p.unresolvedClauses().isEmpty()) {
            log.warn("Runbook {} imported with {} unknown clause reference(s): {}", rb.getRunbookCode(),
                p.unresolvedClauses().size(), p.unresolvedClauses());
        }
        return rb;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static List<String> strings(Object o) {
        if (!(o instanceof List<?> l)) return new ArrayList<>();
        return l.stream().filter(Objects::nonNull).map(String::valueOf).collect(Collectors.toCollection(ArrayList::new));
    }

    /** Roles allowed to approve and publish (spec §10). */
    public static boolean isApprover(User u) {
        return AppRole.CCO.equals(u.getRole()) || AppRole.TENANT_ADMIN.equals(u.getRole());
    }
}
