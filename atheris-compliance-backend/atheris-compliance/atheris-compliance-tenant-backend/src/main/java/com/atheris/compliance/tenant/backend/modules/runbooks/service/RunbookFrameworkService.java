package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.*;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.*;

/** Framework/clause library, the coverage matrix and the dashboard widget. */
@Service
@RequiredArgsConstructor
public class RunbookFrameworkService {

    private final RunbookFrameworkRepository frameworks;
    private final RunbookFrameworkClauseRepository clauses;
    private final RunbookClauseMapRepository clauseMap;
    private final RunbookRepository runbooks;
    private final RunbookVersionRepository versions;
    private final RunbookScheduleRepository schedules;
    private final RunbookReviewScheduleRepository reviewSchedules;
    private final RunbookExecutionRepository executions;
    private final RunbookExecutionEscalationRepository escalations;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<FrameworkDto> list() {
        Map<Integer, Long> counts = new HashMap<>();
        clauses.countByFramework().forEach(r -> counts.put(((Number) r[0]).intValue(), ((Number) r[1]).longValue()));
        return frameworks.findAllByOrderByIsInternalAscCodeAsc().stream().map(f -> toDto(f, counts.getOrDefault(f.getFrameworkId(), 0L))).toList();
    }

    private static FrameworkDto toDto(RunbookFramework f, long count) {
        return FrameworkDto.builder().frameworkId(f.getFrameworkId()).code(f.getCode()).name(f.getName()).issuer(f.getIssuer())
            .jurisdiction(f.getJurisdiction()).versionLabel(f.getVersionLabel()).sourceUrl(f.getSourceUrl())
            .internal(f.getIsInternal()).clauseCount(count).build();
    }

    @Transactional(readOnly = true)
    public List<ClauseDto> clauses(Integer frameworkId, String q, String domain) {
        if (frameworkId != null) frameworks.findById(frameworkId).orElseThrow(() -> ApiException.notFound("Framework not found: " + frameworkId));
        Specification<RunbookFrameworkClause> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (frameworkId != null) p.add(cb.equal(root.get("frameworkId"), frameworkId));
            if (domain != null && !domain.isBlank()) p.add(cb.equal(root.get("domain"), domain));
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("clauseRef")), like), cb.like(cb.lower(root.get("title")), like),
                    cb.like(cb.lower(root.get("domain")), like)));
            }
            return cb.and(p.toArray(new Predicate[0]));
        };
        List<RunbookFrameworkClause> rows = clauses.findAll(spec, PageRequest.of(0, 200, Sort.by("frameworkId", "clauseRef"))).getContent();
        Map<Integer, String> codes = frameworks.findAllById(rows.stream().map(RunbookFrameworkClause::getFrameworkId).collect(Collectors.toSet()))
            .stream().collect(Collectors.toMap(RunbookFramework::getFrameworkId, RunbookFramework::getCode));
        return rows.stream().map(c -> toDto(c, codes.get(c.getFrameworkId()))).toList();
    }

    private static ClauseDto toDto(RunbookFrameworkClause c, String code) {
        return ClauseDto.builder().clauseId(c.getClauseId()).frameworkId(c.getFrameworkId()).frameworkCode(code)
            .clauseRef(c.getClauseRef()).title(c.getTitle()).requirementText(c.getRequirementText()).domain(c.getDomain())
            .deadlineRule(c.getDeadlineRule()).slaMinutes(c.getSlaMinutes()).build();
    }

    /** Tenant internal policy framework (spec §2.3: a runbook may map to an internal policy instead). */
    @Transactional
    public FrameworkDto createInternal(FrameworkRequest req, Integer userId) {
        if (req.getCode() == null || !req.getCode().trim().matches("[A-Za-z0-9._-]{2,50}")) {
            throw ApiException.badRequest("The code must be 2–50 letters, digits, '.', '_' or '-'");
        }
        if (req.getName() == null || req.getName().isBlank()) throw ApiException.badRequest("Name is required");
        String code = req.getCode().trim().toUpperCase();
        if (frameworks.findByCode(code).isPresent()) throw ApiException.conflict("already_exists", "Framework " + code + " already exists");
        RunbookFramework f = frameworks.save(RunbookFramework.builder().code(code).name(req.getName().trim())
            .issuer(req.getIssuer() != null ? req.getIssuer() : "Internal").jurisdiction("NG")
            .versionLabel(req.getVersionLabel()).isInternal(true).build());
        audit.log(userId, "runbook_framework_created", "runbook_framework", f.getFrameworkId().longValue(), Map.of("code", code));
        return toDto(f, 0);
    }

    @Transactional
    public ClauseDto addClause(Integer frameworkId, ClauseRequest req, Integer userId) {
        RunbookFramework f = frameworks.findById(frameworkId).orElseThrow(() -> ApiException.notFound("Framework not found: " + frameworkId));
        if (!Boolean.TRUE.equals(f.getIsInternal())) {
            throw ApiException.conflict("Clauses can only be added to internal policy frameworks; the regulatory library is maintained by Atheris");
        }
        if (req.getClauseRef() == null || req.getClauseRef().isBlank() || req.getTitle() == null || req.getTitle().isBlank()) {
            throw ApiException.badRequest("Clause reference and title are required");
        }
        if (clauses.existsByFrameworkIdAndClauseRef(frameworkId, req.getClauseRef().trim())) {
            throw ApiException.conflict("already_exists", "Clause " + req.getClauseRef() + " already exists");
        }
        if (req.getSlaMinutes() != null && req.getSlaMinutes() <= 0) throw ApiException.badRequest("SLA minutes must be positive");
        RunbookFrameworkClause c = clauses.save(RunbookFrameworkClause.builder().frameworkId(frameworkId)
            .clauseRef(req.getClauseRef().trim()).title(req.getTitle().trim()).requirementText(req.getRequirementText())
            .domain(req.getDomain()).deadlineRule(req.getDeadlineRule()).slaMinutes(req.getSlaMinutes()).build());
        audit.log(userId, "runbook_clause_created", "runbook_framework", frameworkId.longValue(), Map.of("clauseRef", c.getClauseRef()));
        return toDto(c, f.getCode());
    }

    // ── coverage ────────────────────────────────────────────────────────────

    /**
     * Framework × clause coverage: RUNBOOK = mapped to ≥1 PUBLISHED runbook; PARTIAL = mapped only
     * to runbooks not yet published; NONE = nothing. Archived/deprecated runbooks do not count.
     */
    @Transactional(readOnly = true)
    public CoverageDto coverage(Integer frameworkId) {
        List<RunbookFramework> fws = frameworkId != null
            ? List.of(frameworks.findById(frameworkId).orElseThrow(() -> ApiException.notFound("Framework not found")))
            : frameworks.findAllByOrderByIsInternalAscCodeAsc();
        Map<Integer, RunbookFramework> fwById = fws.stream().collect(Collectors.toMap(RunbookFramework::getFrameworkId, Function.identity()));
        List<RunbookFrameworkClause> cls = clauses.findByFrameworkIdIn(fwById.keySet());
        List<RunbookClauseMap> maps = cls.isEmpty() ? List.of() : clauseMap.findByClauseIdIn(cls.stream().map(RunbookFrameworkClause::getClauseId).toList());
        Map<Long, Runbook> rbs = runbooks.findAllById(maps.stream().map(RunbookClauseMap::getRunbookId).collect(Collectors.toSet()))
            .stream().filter(r -> !RB_ARCHIVED.equals(r.getStatus()) && !RB_DEPRECATED.equals(r.getStatus()))
            .collect(Collectors.toMap(Runbook::getRunbookId, Function.identity()));
        Map<Long, List<Runbook>> byClause = new HashMap<>();
        maps.forEach(m -> { Runbook r = rbs.get(m.getRunbookId()); if (r != null) byClause.computeIfAbsent(m.getClauseId(), k -> new ArrayList<>()).add(r); });

        List<CoverageDto.Cell> cells = new ArrayList<>();
        Map<Integer, int[]> tallies = new HashMap<>(); // total, covered, partial
        for (RunbookFrameworkClause c : cls.stream().sorted(Comparator.comparing(RunbookFrameworkClause::getFrameworkId)
                .thenComparing(RunbookFrameworkClause::getClauseRef)).toList()) {
            List<Runbook> mapped = byClause.getOrDefault(c.getClauseId(), List.of());
            String status = mapped.stream().anyMatch(r -> r.getCurrentVersionId() != null) ? "RUNBOOK" : mapped.isEmpty() ? "NONE" : "PARTIAL";
            int[] t = tallies.computeIfAbsent(c.getFrameworkId(), k -> new int[3]);
            t[0]++;
            if ("RUNBOOK".equals(status)) t[1]++;
            if ("PARTIAL".equals(status)) t[2]++;
            cells.add(CoverageDto.Cell.builder().clauseId(c.getClauseId()).frameworkId(c.getFrameworkId())
                .frameworkCode(fwById.get(c.getFrameworkId()).getCode()).clauseRef(c.getClauseRef()).title(c.getTitle())
                .domain(c.getDomain()).status(status)
                .runbooks(mapped.stream().map(r -> CoverageDto.RunbookRef.builder().runbookId(r.getRunbookId())
                    .runbookCode(r.getRunbookCode()).title(r.getTitle()).status(r.getStatus()).build()).toList())
                .build());
        }
        List<CoverageDto.FrameworkCoverage> fwCov = fws.stream().filter(f -> tallies.containsKey(f.getFrameworkId())).map(f -> {
            int[] t = tallies.get(f.getFrameworkId());
            return CoverageDto.FrameworkCoverage.builder().frameworkId(f.getFrameworkId()).code(f.getCode()).name(f.getName())
                .total(t[0]).covered(t[1]).partial(t[2]).uncovered(t[0] - t[1] - t[2])
                .coveragePct(t[0] == 0 ? 0 : (int) Math.round(100.0 * t[1] / t[0])).build();
        }).toList();
        return CoverageDto.builder().frameworks(fwCov).cells(cells).build();
    }

    // ── dashboard ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public RunbookDashboardDto dashboard() {
        LocalDate today = LocalDate.now();
        List<RunbookSchedule> upcoming = schedules.findByIsActiveTrueAndNextRunAtBetweenOrderByNextRunAtAsc(today, today.plusDays(7));
        Map<Long, Runbook> rbs = runbooks.findAllById(upcoming.stream().map(RunbookSchedule::getRunbookId).collect(Collectors.toSet()))
            .stream().collect(Collectors.toMap(Runbook::getRunbookId, Function.identity()));
        List<RunbookExecution> active = executions.findByStatusIn(ACTIVE_EXECUTION_STATUSES);
        return RunbookDashboardDto.builder()
            .upcoming7d((long) upcoming.size())
            .overdue(active.stream().filter(RunbookViews::isOverdue).count())
            .openEscalations(openEscalations())
            .reviewBacklog((long) reviewSchedules.findByNextReviewAtLessThanEqual(today).size())
            .pendingApprovals((long) versions.findByStatusOrderBySubmittedAtAsc(V_IN_REVIEW).size())
            .activeExecutions((long) active.size())
            .upcoming(upcoming.stream().filter(s -> rbs.containsKey(s.getRunbookId())).limit(5).map(s -> RunbookDashboardDto.Upcoming.builder()
                .runbookId(s.getRunbookId()).runbookCode(rbs.get(s.getRunbookId()).getRunbookCode())
                .title(rbs.get(s.getRunbookId()).getTitle()).nextRunAt(s.getNextRunAt()).build()).toList())
            .build();
    }

    /** Open escalations of runs still in progress — those of closed runs are not open any more. */
    private long openEscalations() {
        List<Long> closed = executions.findByStatusIn(CLOSED_EXECUTION_STATUSES).stream()
            .map(RunbookExecution::getExecutionId).toList();
        return closed.isEmpty() ? escalations.countByAcknowledgedAtIsNull()
            : escalations.countByAcknowledgedAtIsNullAndExecutionIdNotIn(closed);
    }
}
