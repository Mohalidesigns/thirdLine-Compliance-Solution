package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.runbooks.dto.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.*;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.*;

/**
 * The content tree of a runbook version (prerequisites, sections → steps → evidence requirements,
 * escalation ladder, rollback steps): batch loading, wholesale replacement of a draft, copying,
 * canonical hashing and step-level diffs. Every load uses one query per table, never one per row.
 */
@Service
@RequiredArgsConstructor
public class RunbookTreeService {

    private final RunbookSectionRepository sections;
    private final RunbookStepRepository steps;
    private final RunbookStepEvidenceReqRepository evidenceReqs;
    private final RunbookStepClauseMapRepository stepClauses;
    private final RunbookPrerequisiteRepository prerequisites;
    private final RunbookEscalationPathRepository escalations;
    private final RunbookRollbackStepRepository rollbacks;
    private final RunbookVersionApprovalRepository approvals;
    private final RunbookFrameworkClauseRepository clauses;
    private final RunbookFrameworkRepository frameworks;
    private final UserRepository users;

    @PersistenceContext
    private EntityManager em;

    private static final ObjectMapper CANONICAL = new ObjectMapper()
        .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
        .configure(com.fasterxml.jackson.databind.MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true);

    // ── load ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public RunbookVersionTreeDto load(RunbookVersion v) {
        Long vid = v.getVersionId();
        List<RunbookSection> secs = sections.findByVersionIdOrderBySortOrderAsc(vid);
        List<Long> secIds = secs.stream().map(RunbookSection::getSectionId).toList();
        List<RunbookStep> stepRows = secIds.isEmpty() ? List.of() : steps.findBySectionIdInOrderBySortOrderAsc(secIds);
        List<Long> stepIds = stepRows.stream().map(RunbookStep::getStepId).toList();
        Map<Long, List<RunbookStepEvidenceReq>> reqsByStep = stepIds.isEmpty() ? Map.of()
            : evidenceReqs.findByStepIdIn(stepIds).stream()
                .sorted(Comparator.comparing(RunbookStepEvidenceReq::getReqId))
                .collect(Collectors.groupingBy(RunbookStepEvidenceReq::getStepId));
        Map<Long, List<Long>> clausesByStep = stepIds.isEmpty() ? Map.of()
            : stepClauses.findByStepIdIn(stepIds).stream().collect(Collectors.groupingBy(
                RunbookStepClauseMap::getStepId, Collectors.mapping(RunbookStepClauseMap::getClauseId, Collectors.toList())));
        Map<Long, List<RunbookStep>> stepsBySection = stepRows.stream().collect(Collectors.groupingBy(RunbookStep::getSectionId));
        Map<Long, String> codeByStepId = stepRows.stream()
            .filter(s -> s.getStepCode() != null)
            .collect(Collectors.toMap(RunbookStep::getStepId, RunbookStep::getStepCode, (a, b) -> a));

        List<RunbookVersionApproval> apprRows = approvals.findByVersionIdOrderByDecidedAtAsc(vid);
        Set<Integer> userIds = new HashSet<>();
        if (v.getAuthoredByUserId() != null) userIds.add(v.getAuthoredByUserId());
        if (v.getApprovedByUserId() != null) userIds.add(v.getApprovedByUserId());
        apprRows.forEach(a -> userIds.add(a.getApproverUserId()));
        Map<Integer, String> names = userNames(userIds);

        return RunbookVersionTreeDto.builder()
            .versionId(vid).runbookId(v.getRunbookId()).versionNumber(v.getVersionNumber())
            .status(v.getStatus()).changeSummary(v.getChangeSummary()).contentHash(v.getContentHash())
            .authoredByUserId(v.getAuthoredByUserId()).authoredByName(names.get(v.getAuthoredByUserId()))
            .approvedByName(names.get(v.getApprovedByUserId())).approvedAt(v.getApprovedAt())
            .publishedAt(v.getPublishedAt()).submittedAt(v.getSubmittedAt()).createdAt(v.getCreatedAt())
            .prerequisites(prerequisites.findByVersionIdOrderBySortOrderAsc(vid).stream().map(p -> PrerequisiteDto.builder()
                .prereqId(p.getPrereqId()).prereqType(p.getPrereqType()).label(p.getLabel())
                .detail(p.getDetail()).mandatory(p.getIsMandatory()).build()).toList())
            .sections(secs.stream().map(s -> SectionDto.builder()
                .sectionId(s.getSectionId()).sortOrder(s.getSortOrder()).sectionType(s.getSectionType())
                .title(s.getTitle()).description(s.getDescription())
                .steps(stepsBySection.getOrDefault(s.getSectionId(), List.of()).stream()
                    .map(st -> toStepDto(st, reqsByStep.getOrDefault(st.getStepId(), List.of()),
                        clausesByStep.getOrDefault(st.getStepId(), List.of())))
                    .toList())
                .build()).toList())
            .escalations(escalations.findByVersionIdOrderByLevelAsc(vid).stream().map(e -> EscalationDto.builder()
                .escalationId(e.getEscalationId()).level(e.getLevel()).triggerType(e.getTriggerType())
                .notifyRole(e.getNotifyRole()).notifyUserId(e.getNotifyUserId()).notifyChannel(e.getNotifyChannel())
                .waitMinutes(e.getWaitMinutes()).instructions(e.getInstructions()).build()).toList())
            .rollbackSteps(rollbacks.findByVersionIdOrderBySortOrderAsc(vid).stream().map(r -> RollbackStepDto.builder()
                .rollbackId(r.getRollbackId()).sortOrder(r.getSortOrder()).reversesStepId(r.getReversesStepId())
                .reversesStepCode(r.getReversesStepCode() != null ? r.getReversesStepCode() : codeByStepId.get(r.getReversesStepId()))
                .title(r.getTitle()).instructionMd(r.getInstructionMd()).commandBlock(r.getCommandBlock())
                .verification(r.getVerification()).build()).toList())
            .approvals(apprRows.stream().map(a -> ApprovalDto.builder()
                .approvalId(a.getApprovalId()).approverUserId(a.getApproverUserId())
                .approverName(names.get(a.getApproverUserId())).approverRole(a.getApproverRole())
                .decision(a.getDecision()).comment(a.getComment()).decidedAt(a.getDecidedAt()).build()).toList())
            .build();
    }

    private StepDto toStepDto(RunbookStep st, List<RunbookStepEvidenceReq> reqs, List<Long> clauseIds) {
        return StepDto.builder()
            .stepId(st.getStepId()).sortOrder(st.getSortOrder()).stepCode(st.getStepCode()).title(st.getTitle())
            .instructionMd(st.getInstructionMd()).commandBlock(st.getCommandBlock()).commandLang(st.getCommandLang())
            .expectedResult(st.getExpectedResult()).durationEstimateMin(st.getDurationEstimateMin())
            .assignedRole(st.getAssignedRole()).blocking(st.getIsBlocking()).dualControl(st.getRequiresDualControl())
            .allowSkip(st.getAllowSkip()).safetyNote(st.getSafetyNote())
            .clauseIds(new ArrayList<>(clauseIds))
            .evidenceReqs(reqs.stream().map(r -> EvidenceReqDto.builder()
                .reqId(r.getReqId()).evidenceType(r.getEvidenceType()).label(r.getLabel())
                .mandatory(r.getIsMandatory()).retentionYears(r.getRetentionYears()).build()).toList())
            .build();
    }

    public int stepCount(RunbookVersionTreeDto tree) {
        return tree.getSections().stream().mapToInt(s -> s.getSteps().size()).sum();
    }

    // ── save ────────────────────────────────────────────────────────────────

    /**
     * Replaces the whole content of a version with {@code req}. Children are deleted and
     * re-created (step ids change), so rollback steps are re-linked through their step code.
     * The caller has already validated the request and checked the version is an editable draft.
     */
    @Transactional
    public void replace(Long versionId, SaveVersionRequest req) {
        // Sections cascade (in the DB) to steps, evidence requirements and step-clause links.
        rollbacks.deleteByVersionId(versionId);
        sections.deleteByVersionId(versionId);
        prerequisites.deleteByVersionId(versionId);
        escalations.deleteByVersionId(versionId);
        em.flush();

        int pi = 0;
        for (PrerequisiteDto p : nz(req.getPrerequisites())) {
            prerequisites.save(RunbookPrerequisite.builder().versionId(versionId).sortOrder(pi++)
                .prereqType(p.getPrereqType()).label(p.getLabel().trim()).detail(blankToNull(p.getDetail()))
                .isMandatory(!Boolean.FALSE.equals(p.getMandatory())).build());
        }

        Map<String, Long> stepIdByCode = new HashMap<>();
        int si = 0;
        for (SectionDto s : nz(req.getSections())) {
            RunbookSection sec = sections.save(RunbookSection.builder().versionId(versionId).sortOrder(si++)
                .sectionType(s.getSectionType()).title(s.getTitle().trim()).description(blankToNull(s.getDescription())).build());
            int ti = 0;
            for (StepDto st : nz(s.getSteps())) {
                String code = blankToNull(st.getStepCode()) != null ? st.getStepCode().trim() : si + "." + (ti + 1);
                RunbookStep step = steps.save(RunbookStep.builder().sectionId(sec.getSectionId()).sortOrder(ti++)
                    .stepCode(code).title(st.getTitle().trim()).instructionMd(st.getInstructionMd().trim())
                    .commandBlock(blankToNull(st.getCommandBlock())).commandLang(blankToNull(st.getCommandLang()))
                    .expectedResult(blankToNull(st.getExpectedResult())).durationEstimateMin(st.getDurationEstimateMin())
                    .assignedRole(blankToNull(st.getAssignedRole()))
                    .isBlocking(!Boolean.FALSE.equals(st.getBlocking()))
                    .requiresDualControl(Boolean.TRUE.equals(st.getDualControl()))
                    .allowSkip(Boolean.TRUE.equals(st.getAllowSkip()))
                    .safetyNote(blankToNull(st.getSafetyNote())).build());
                stepIdByCode.putIfAbsent(code, step.getStepId());
                for (EvidenceReqDto r : nz(st.getEvidenceReqs())) {
                    evidenceReqs.save(RunbookStepEvidenceReq.builder().stepId(step.getStepId())
                        .evidenceType(r.getEvidenceType()).label(r.getLabel().trim())
                        .isMandatory(!Boolean.FALSE.equals(r.getMandatory()))
                        .retentionYears(r.getRetentionYears() != null ? r.getRetentionYears() : 7).build());
                }
                for (Long cid : new LinkedHashSet<>(nz(st.getClauseIds()))) {
                    stepClauses.save(RunbookStepClauseMap.builder().stepId(step.getStepId()).clauseId(cid).build());
                }
            }
        }

        for (EscalationDto e : nz(req.getEscalations())) {
            escalations.save(RunbookEscalationPath.builder().versionId(versionId).level(e.getLevel())
                .triggerType(e.getTriggerType()).notifyRole(blankToNull(e.getNotifyRole()))
                .notifyUserId(e.getNotifyUserId())
                .notifyChannel(blankToNull(e.getNotifyChannel()) != null ? e.getNotifyChannel() : "IN_APP")
                .waitMinutes(e.getWaitMinutes() != null ? e.getWaitMinutes() : 0)
                .instructions(blankToNull(e.getInstructions())).build());
        }

        int ri = 0;
        for (RollbackStepDto r : nz(req.getRollbackSteps())) {
            String code = blankToNull(r.getReversesStepCode());
            rollbacks.save(RunbookRollbackStep.builder().versionId(versionId).sortOrder(ri++)
                .reversesStepCode(code).reversesStepId(code != null ? stepIdByCode.get(code) : null)
                .title(r.getTitle().trim()).instructionMd(r.getInstructionMd().trim())
                .commandBlock(blankToNull(r.getCommandBlock())).verification(blankToNull(r.getVerification())).build());
        }
        em.flush();
    }

    /** Copies the content of one version into another (new draft from the published version). */
    @Transactional
    public void copy(RunbookVersion from, Long toVersionId) {
        replace(toVersionId, toSaveRequest(load(from)));
    }

    public SaveVersionRequest toSaveRequest(RunbookVersionTreeDto t) {
        return SaveVersionRequest.builder()
            .prerequisites(t.getPrerequisites()).sections(t.getSections())
            .escalations(t.getEscalations()).rollbackSteps(t.getRollbackSteps()).build();
    }

    // ── hash / portable format ─────────────────────────────────────────────

    /**
     * Portable runbook JSON ("atheris-runbook/1") — the template content format and the
     * export/import format. Clause ids are written as {framework, clauseRef} so the file is
     * meaningful outside this tenant.
     */
    public Map<String, Object> toPortable(Runbook rb, RunbookVersionTreeDto tree, List<Long> runbookClauseIds) {
        Set<Long> allClauseIds = new HashSet<>(runbookClauseIds);
        tree.getSections().forEach(s -> s.getSteps().forEach(st -> allClauseIds.addAll(st.getClauseIds())));
        Map<Long, Map<String, Object>> clauseRefs = clauseRefs(allClauseIds);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("format", "atheris-runbook/1");
        if (rb.getSourceTemplateCode() != null) {
            m.put("templateCode", rb.getSourceTemplateCode());
            m.put("templateVersion", rb.getSourceTemplateVer());
        }
        m.put("runbookCode", rb.getRunbookCode());
        m.put("versionNumber", tree.getVersionNumber());
        m.put("title", rb.getTitle());
        m.put("category", rb.getCategory());
        m.put("criticality", rb.getCriticality());
        m.put("frequency", rb.getFrequency());
        m.put("slaMinutes", rb.getSlaMinutes());
        m.put("objective", rb.getObjective());
        m.put("reviewCadence", rb.getReviewCadence());
        m.put("scopeSystems", rb.getScopeSystems());
        m.put("scopeTeams", rb.getScopeTeams());
        m.put("tags", rb.getTags());
        m.put("clauses", runbookClauseIds.stream().map(clauseRefs::get).filter(Objects::nonNull).toList());
        m.put("prerequisites", tree.getPrerequisites().stream().map(p -> ordered(
            "prereqType", p.getPrereqType(), "label", p.getLabel(), "detail", p.getDetail(), "mandatory", p.getMandatory())).toList());
        m.put("sections", tree.getSections().stream().map(s -> {
            Map<String, Object> sm = ordered("sectionType", s.getSectionType(), "title", s.getTitle(), "description", s.getDescription());
            sm.put("steps", s.getSteps().stream().map(st -> {
                Map<String, Object> x = ordered("stepCode", st.getStepCode(), "title", st.getTitle(),
                    "instructionMd", st.getInstructionMd(), "commandBlock", st.getCommandBlock(), "commandLang", st.getCommandLang(),
                    "expectedResult", st.getExpectedResult(), "durationEstimateMin", st.getDurationEstimateMin(),
                    "assignedRole", st.getAssignedRole(), "blocking", st.getBlocking(), "dualControl", st.getDualControl(),
                    "allowSkip", st.getAllowSkip(), "safetyNote", st.getSafetyNote());
                x.put("clauses", st.getClauseIds().stream().map(clauseRefs::get).filter(Objects::nonNull).toList());
                x.put("evidenceReqs", st.getEvidenceReqs().stream().map(r -> ordered("evidenceType", r.getEvidenceType(),
                    "label", r.getLabel(), "mandatory", r.getMandatory(), "retentionYears", r.getRetentionYears())).toList());
                return x;
            }).toList());
            return sm;
        }).toList());
        m.put("escalations", tree.getEscalations().stream().map(e -> ordered("level", e.getLevel(),
            "triggerType", e.getTriggerType(), "notifyRole", e.getNotifyRole(), "notifyChannel", e.getNotifyChannel(),
            "waitMinutes", e.getWaitMinutes(), "instructions", e.getInstructions())).toList());
        m.put("rollback", tree.getRollbackSteps().stream().map(r -> ordered("reversesStepCode", r.getReversesStepCode(),
            "title", r.getTitle(), "instructionMd", r.getInstructionMd(), "commandBlock", r.getCommandBlock(),
            "verification", r.getVerification())).toList());
        return m;
    }

    /** Parsed portable runbook: metadata + the version tree + clause references to resolve. */
    public record PortableRunbook(Map<String, Object> meta, SaveVersionRequest tree, List<Long> clauseIds, List<String> unresolvedClauses) {}

    /** Reads the portable format, resolving {framework, clauseRef} to this tenant's clause ids. */
    @SuppressWarnings("unchecked")
    public PortableRunbook fromPortable(Map<String, Object> m) {
        if (m == null || !(m.get("sections") instanceof List)) {
            throw ApiException.badRequest("invalid_runbook_format", "Not an Atheris runbook file (no sections)");
        }
        Map<String, Long> clauseIndex = clauseIndex();
        List<String> unresolved = new ArrayList<>();
        Function<Object, List<Long>> resolve = raw -> {
            List<Long> ids = new ArrayList<>();
            if (raw instanceof List<?> list) {
                for (Object o : list) {
                    if (!(o instanceof Map<?, ?> c)) continue;
                    String key = c.get("framework") + "|" + c.get("clauseRef");
                    Long id = clauseIndex.get(key);
                    if (id != null) ids.add(id);
                    else if (!unresolved.contains(key.replace('|', ' '))) unresolved.add(key.replace('|', ' '));
                }
            }
            return ids;
        };
        List<SectionDto> secs = new ArrayList<>();
        for (Object so : (List<Object>) m.get("sections")) {
            Map<String, Object> s = (Map<String, Object>) so;
            List<StepDto> stepList = new ArrayList<>();
            for (Object to : listOf(s.get("steps"))) {
                Map<String, Object> t = (Map<String, Object>) to;
                stepList.add(StepDto.builder().stepCode(str(t.get("stepCode"))).title(str(t.get("title")))
                    .instructionMd(str(t.get("instructionMd"))).commandBlock(str(t.get("commandBlock")))
                    .commandLang(str(t.get("commandLang"))).expectedResult(str(t.get("expectedResult")))
                    .durationEstimateMin(intOf(t.get("durationEstimateMin"))).assignedRole(str(t.get("assignedRole")))
                    .blocking(boolOf(t.get("blocking"), true)).dualControl(boolOf(t.get("dualControl"), false))
                    .allowSkip(boolOf(t.get("allowSkip"), false)).safetyNote(str(t.get("safetyNote")))
                    .clauseIds(resolve.apply(t.get("clauses")))
                    .evidenceReqs(listOf(t.get("evidenceReqs")).stream().map(ro -> {
                        Map<String, Object> r = (Map<String, Object>) ro;
                        return EvidenceReqDto.builder().evidenceType(str(r.get("evidenceType"))).label(str(r.get("label")))
                            .mandatory(boolOf(r.get("mandatory"), true)).retentionYears(intOf(r.get("retentionYears"))).build();
                    }).toList())
                    .build());
            }
            secs.add(SectionDto.builder().sectionType(str(s.get("sectionType"))).title(str(s.get("title")))
                .description(str(s.get("description"))).steps(stepList).build());
        }
        SaveVersionRequest tree = SaveVersionRequest.builder()
            .prerequisites(listOf(m.get("prerequisites")).stream().map(po -> {
                Map<String, Object> p = (Map<String, Object>) po;
                return PrerequisiteDto.builder().prereqType(str(p.get("prereqType"))).label(str(p.get("label")))
                    .detail(str(p.get("detail"))).mandatory(boolOf(p.get("mandatory"), true)).build();
            }).toList())
            .sections(secs)
            .escalations(listOf(m.get("escalations")).stream().map(eo -> {
                Map<String, Object> e = (Map<String, Object>) eo;
                return EscalationDto.builder().level(intOf(e.get("level"))).triggerType(str(e.get("triggerType")))
                    .notifyRole(str(e.get("notifyRole"))).notifyChannel(str(e.get("notifyChannel")))
                    .waitMinutes(intOf(e.get("waitMinutes"))).instructions(str(e.get("instructions"))).build();
            }).toList())
            .rollbackSteps(listOf(m.get("rollback")).stream().map(ro -> {
                Map<String, Object> r = (Map<String, Object>) ro;
                return RollbackStepDto.builder().reversesStepCode(str(r.get("reversesStepCode"))).title(str(r.get("title")))
                    .instructionMd(str(r.get("instructionMd"))).commandBlock(str(r.get("commandBlock")))
                    .verification(str(r.get("verification"))).build();
            }).toList())
            .build();
        return new PortableRunbook(m, tree, resolve.apply(m.get("clauses")), unresolved);
    }

    /** SHA-256 of the canonical JSON of the version content (computed at publish). */
    public String contentHash(Runbook rb, RunbookVersionTreeDto tree, List<Long> clauseIds) {
        Map<String, Object> p = toPortable(rb, tree, clauseIds);
        p.remove("versionNumber");
        return sha256(canonicalJson(p));
    }

    public static String canonicalJson(Object o) {
        try {
            return CANONICAL.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException("Canonical JSON failed", e);
        }
    }

    public static String sha256(String s) {
        return sha256(s.getBytes(StandardCharsets.UTF_8));
    }

    public static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // ── diff ────────────────────────────────────────────────────────────────

    public VersionDiffDto diff(RunbookVersionTreeDto from, RunbookVersionTreeDto to) {
        Map<String, StepDto> a = stepsByCode(from);
        Map<String, StepDto> b = stepsByCode(to);
        List<VersionDiffDto.StepDiffDto> added = new ArrayList<>();
        List<VersionDiffDto.StepDiffDto> removed = new ArrayList<>();
        List<VersionDiffDto.StepDiffDto> changed = new ArrayList<>();
        for (var e : b.entrySet()) {
            StepDto old = a.get(e.getKey());
            if (old == null) {
                added.add(VersionDiffDto.StepDiffDto.builder().stepCode(e.getKey()).title(e.getValue().getTitle()).build());
                continue;
            }
            List<VersionDiffDto.FieldChange> ch = stepChanges(old, e.getValue());
            if (!ch.isEmpty()) {
                changed.add(VersionDiffDto.StepDiffDto.builder().stepCode(e.getKey()).title(e.getValue().getTitle()).changes(ch).build());
            }
        }
        for (var e : a.entrySet()) {
            if (!b.containsKey(e.getKey())) {
                removed.add(VersionDiffDto.StepDiffDto.builder().stepCode(e.getKey()).title(e.getValue().getTitle()).build());
            }
        }
        List<VersionDiffDto.FieldChange> meta = new ArrayList<>();
        field(meta, "prerequisites", summary(from.getPrerequisites(), PrerequisiteDto::getLabel), summary(to.getPrerequisites(), PrerequisiteDto::getLabel));
        field(meta, "sections", summary(from.getSections(), s -> s.getSectionType() + ": " + s.getTitle()),
            summary(to.getSections(), s -> s.getSectionType() + ": " + s.getTitle()));
        field(meta, "escalations", summary(from.getEscalations(), e -> "L" + e.getLevel() + " " + e.getTriggerType() + " → " + e.getNotifyRole()),
            summary(to.getEscalations(), e -> "L" + e.getLevel() + " " + e.getTriggerType() + " → " + e.getNotifyRole()));
        field(meta, "rollbackSteps", summary(from.getRollbackSteps(), RollbackStepDto::getTitle), summary(to.getRollbackSteps(), RollbackStepDto::getTitle));
        return VersionDiffDto.builder().fromVersionNumber(from.getVersionNumber()).toVersionNumber(to.getVersionNumber())
            .added(added).removed(removed).changed(changed).metadata(meta).build();
    }

    private Map<String, StepDto> stepsByCode(RunbookVersionTreeDto t) {
        Map<String, StepDto> m = new LinkedHashMap<>();
        t.getSections().forEach(s -> s.getSteps().forEach(st -> m.putIfAbsent(
            st.getStepCode() != null ? st.getStepCode() : st.getTitle(), st)));
        return m;
    }

    private List<VersionDiffDto.FieldChange> stepChanges(StepDto x, StepDto y) {
        List<VersionDiffDto.FieldChange> ch = new ArrayList<>();
        field(ch, "title", x.getTitle(), y.getTitle());
        field(ch, "instructionMd", x.getInstructionMd(), y.getInstructionMd());
        field(ch, "commandBlock", x.getCommandBlock(), y.getCommandBlock());
        field(ch, "commandLang", x.getCommandLang(), y.getCommandLang());
        field(ch, "expectedResult", x.getExpectedResult(), y.getExpectedResult());
        field(ch, "assignedRole", x.getAssignedRole(), y.getAssignedRole());
        field(ch, "blocking", str(x.getBlocking()), str(y.getBlocking()));
        field(ch, "dualControl", str(x.getDualControl()), str(y.getDualControl()));
        field(ch, "allowSkip", str(x.getAllowSkip()), str(y.getAllowSkip()));
        field(ch, "safetyNote", x.getSafetyNote(), y.getSafetyNote());
        field(ch, "evidenceReqs", summary(x.getEvidenceReqs(), r -> r.getEvidenceType() + ": " + r.getLabel()),
            summary(y.getEvidenceReqs(), r -> r.getEvidenceType() + ": " + r.getLabel()));
        field(ch, "clauses", String.valueOf(new TreeSet<>(x.getClauseIds())), String.valueOf(new TreeSet<>(y.getClauseIds())));
        return ch;
    }

    private static void field(List<VersionDiffDto.FieldChange> out, String name, String before, String after) {
        if (!Objects.equals(blankToNull(before), blankToNull(after))) {
            out.add(VersionDiffDto.FieldChange.builder().field(name).before(before).after(after).build());
        }
    }

    private static <T> String summary(List<T> list, Function<T, String> f) {
        return list == null || list.isEmpty() ? null : list.stream().map(f).collect(Collectors.joining("; "));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** clauseId → {framework, clauseRef} */
    public Map<Long, Map<String, Object>> clauseRefs(Collection<Long> clauseIds) {
        if (clauseIds.isEmpty()) return Map.of();
        List<RunbookFrameworkClause> rows = clauses.findAllById(clauseIds);
        Map<Integer, String> fwCodes = frameworkCodes(rows.stream().map(RunbookFrameworkClause::getFrameworkId).collect(Collectors.toSet()));
        Map<Long, Map<String, Object>> out = new HashMap<>();
        rows.forEach(c -> out.put(c.getClauseId(), ordered("framework", fwCodes.get(c.getFrameworkId()), "clauseRef", c.getClauseRef())));
        return out;
    }

    private Map<Integer, String> frameworkCodes(Set<Integer> ids) {
        if (ids.isEmpty()) return Map.of();
        return frameworks.findAllById(ids).stream()
            .collect(Collectors.toMap(RunbookFramework::getFrameworkId, RunbookFramework::getCode));
    }

    /** "FRAMEWORK|clauseRef" → clauseId over the whole library. */
    private Map<String, Long> clauseIndex() {
        List<RunbookFrameworkClause> all = clauses.findAll();
        Map<Integer, String> fwCodes = frameworkCodes(all.stream().map(RunbookFrameworkClause::getFrameworkId).collect(Collectors.toSet()));
        Map<String, Long> idx = new HashMap<>();
        all.forEach(c -> idx.put(fwCodes.get(c.getFrameworkId()) + "|" + c.getClauseRef(), c.getClauseId()));
        return idx;
    }

    public Map<Integer, String> userNames(Collection<Integer> ids) {
        Set<Integer> clean = ids.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (clean.isEmpty()) return new HashMap<>();
        return users.findAllById(clean).stream().collect(Collectors.toMap(User::getUserId, User::getFullName, (a, b) -> a, HashMap::new));
    }

    private static Map<String, Object> ordered(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    private static <T> List<T> nz(List<T> l) {
        return l == null ? List.of() : l;
    }

    private static List<Object> listOf(Object o) {
        if (o instanceof List<?> l) return new ArrayList<>(l);
        return List.of();
    }

    static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Integer intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s && !s.isBlank()) {
            try { return Integer.parseInt(s.trim()); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    private static Boolean boolOf(Object o, boolean dflt) {
        if (o instanceof Boolean b) return b;
        if (o instanceof String s) return Boolean.parseBoolean(s);
        return dflt;
    }
}
