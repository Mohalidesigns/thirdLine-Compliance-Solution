package com.atheris.compliance.tenant.backend.modules.runbooks.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.runbooks.dto.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.*;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.*;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static com.atheris.compliance.tenant.backend.modules.runbooks.RunbookConstants.*;

/**
 * Platform-authored runbook templates (spec §9.5). Templates live on the intelligence platform and
 * are pulled on demand (the platform no longer pushes webhooks); adopting one creates a tenant
 * runbook DRAFT v1 with provenance (template code + version). A newer platform version flags
 * "update available" and can be turned into a new draft revision.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RunbookTemplateService {

    private static final long CACHE_MS = 60_000;

    private final PlatformApiClient platform;
    private final RunbookRepository runbooks;
    private final RunbookVersionRepository versions;
    private final RunbookClauseMapRepository clauseMap;
    private final RunbookService runbookService;
    private final RunbookTreeService tree;
    private final RunbookLintService lint;
    private final AuditService audit;

    private volatile List<Map<String, Object>> cached;
    private volatile long cachedAt;

    private List<Map<String, Object>> summaries(boolean required) {
        if (cached != null && System.currentTimeMillis() - cachedAt < CACHE_MS) return cached;
        List<Map<String, Object>> fresh = platform.fetchRunbookTemplates();
        if (fresh == null) {
            if (required) throw new ApiException(HttpStatus.BAD_GATEWAY, "platform_unavailable",
                "The Atheris platform could not be reached to load runbook templates");
            return cached != null ? cached : List.of();
        }
        cached = fresh;
        cachedAt = System.currentTimeMillis();
        return fresh;
    }

    /** Latest platform version of a template, or null when unknown (platform unreachable). */
    public Integer latestVersion(String code) {
        if (code == null) return null;
        try {
            return summaries(false).stream().filter(t -> code.equals(t.get("templateCode")))
                .map(t -> intOf(t.get("templateVersion"))).filter(Objects::nonNull).findFirst().orElse(null);
        } catch (Throwable e) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public List<TemplateSummaryDto> list() {
        Map<String, Runbook> adopted = adoptedByCode();
        return summaries(true).stream().map(t -> summary(t, adopted)).toList();
    }

    @Transactional(readOnly = true)
    public TemplateDetailDto get(String code) {
        Map<String, Object> t = fetch(code);
        TemplateSummaryDto s = summary(t, adoptedByCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> content = t.get("content") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        return TemplateDetailDto.builder().templateCode(s.getTemplateCode()).templateVersion(s.getTemplateVersion())
            .title(s.getTitle()).category(s.getCategory()).criticality(s.getCriticality()).frequency(s.getFrequency())
            .slaMinutes(s.getSlaMinutes()).objective(s.getObjective()).stepCount(s.getStepCount())
            .sectionCount(s.getSectionCount()).clauseRefs(s.getClauseRefs()).adopted(s.getAdopted())
            .adoptedRunbookId(s.getAdoptedRunbookId()).adoptedTemplateVersion(s.getAdoptedTemplateVersion())
            .updateAvailable(s.getUpdateAvailable()).updatedAt(s.getUpdatedAt()).content(content).build();
    }

    @Transactional
    public RunbookDetailDto adopt(String code, AdoptTemplateRequest req, User user) {
        if (req.getOwnerUserId() == null) throw ApiException.badRequest("An owner is required");
        Map<String, Object> t = fetch(code);
        Map<String, Object> content = content(t);
        Map<String, Object> doc = new LinkedHashMap<>(content);
        if (req.getTitle() != null && !req.getTitle().isBlank()) doc.put("title", req.getTitle().trim());
        doc.put("runbookCode", code);
        Runbook rb = runbookService.createFromPortable(doc, req.getOwnerUserId(), user);
        Integer ver = intOf(t.get("templateVersion"));
        rb.setSourceTemplateCode(code);
        rb.setSourceTemplateVer(ver != null ? ver : 1);
        runbooks.save(rb);
        if (!req.getObligationIds().isEmpty() || !req.getControlIds().isEmpty()) {
            runbookService.setLinks(rb.getRunbookId(), LinksRequest.builder()
                .obligationIds(req.getObligationIds()).controlIds(req.getControlIds()).build(), user);
        }
        audit.log(user.getUserId(), "runbook_template_adopted", SUBJECT_RUNBOOK, rb.getRunbookId(),
            Map.of("template", code, "templateVersion", String.valueOf(ver), "code", rb.getRunbookCode()));
        return runbookService.detail(rb, ver);
    }

    /**
     * New DRAFT revision built from the latest platform template content (M30 "Create revision
     * from update"). The tenant's own clause mappings are kept; the template's clauses are added.
     */
    @Transactional
    public RunbookDetailDto revisionFromTemplate(Long runbookId, User user) {
        Runbook rb = runbookService.find(runbookId);
        if (rb.getSourceTemplateCode() == null) throw ApiException.conflict("This runbook was not adopted from a template");
        if (RB_ARCHIVED.equals(rb.getStatus())) throw ApiException.conflict("Archived runbooks cannot be revised");
        versions.findFirstByRunbookIdAndStatusInOrderByVersionNumberDesc(runbookId, OPEN_VERSION_STATUSES).ifPresent(v -> {
            throw ApiException.conflict("open_draft_exists", "Version " + v.getVersionNumber() + " is already open — finish or reject it first");
        });
        Map<String, Object> t = fetch(rb.getSourceTemplateCode());
        RunbookTreeService.PortableRunbook p = tree.fromPortable(content(t));
        lint.validateTree(p.tree());
        int next = versions.findFirstByRunbookIdOrderByVersionNumberDesc(runbookId).map(v -> v.getVersionNumber() + 1).orElse(1);
        RunbookVersion draft = versions.save(RunbookVersion.builder().runbookId(runbookId).versionNumber(next)
            .status(V_DRAFT).authoredByUserId(user.getUserId())
            .changeSummary("Revision from template " + rb.getSourceTemplateCode() + " v" + t.get("templateVersion")).build());
        tree.replace(draft.getVersionId(), p.tree());
        Set<Long> mapped = clauseMap.findByRunbookId(runbookId).stream().map(RunbookClauseMap::getClauseId).collect(Collectors.toSet());
        p.clauseIds().stream().filter(mapped::add)
            .forEach(cid -> clauseMap.save(RunbookClauseMap.builder().runbookId(runbookId).clauseId(cid).build()));
        Integer ver = intOf(t.get("templateVersion"));
        rb.setSourceTemplateVer(ver);
        rb.setUpdatedAt(Instant.now());
        runbooks.save(rb);
        audit.log(user.getUserId(), "runbook_template_revision", SUBJECT_RUNBOOK, runbookId,
            Map.of("template", rb.getSourceTemplateCode(), "templateVersion", String.valueOf(ver), "version", next));
        return runbookService.detail(rb, ver);
    }

    private Map<String, Object> fetch(String code) {
        Map<String, Object> t = platform.fetchRunbookTemplate(code);
        if (t == null) {
            if (platform.fetchRunbookTemplates() == null) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "platform_unavailable", "The Atheris platform could not be reached");
            }
            throw ApiException.notFound("Runbook template not found: " + code);
        }
        return t;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> content(Map<String, Object> t) {
        if (!(t.get("content") instanceof Map<?, ?> m)) throw ApiException.badRequest("The template has no content");
        return (Map<String, Object>) m;
    }

    /** Most recent non-archived runbook per template code. */
    private Map<String, Runbook> adoptedByCode() {
        Map<String, Runbook> m = new HashMap<>();
        runbooks.findBySourceTemplateCodeIsNotNull().stream().filter(r -> !RB_ARCHIVED.equals(r.getStatus()))
            .forEach(r -> m.merge(r.getSourceTemplateCode(), r, (a, b) -> a.getRunbookId() > b.getRunbookId() ? a : b));
        return m;
    }

    private TemplateSummaryDto summary(Map<String, Object> t, Map<String, Runbook> adopted) {
        String code = str(t.get("templateCode"));
        Runbook rb = adopted.get(code);
        Integer ver = intOf(t.get("templateVersion"));
        List<String> refs = t.get("clauseRefs") instanceof List<?> l ? l.stream().map(String::valueOf).toList() : List.of();
        Instant updated = null;
        try { if (t.get("updatedAt") != null) updated = Instant.parse(String.valueOf(t.get("updatedAt"))); } catch (Exception ignored) {}
        return TemplateSummaryDto.builder().templateCode(code).templateVersion(ver).title(str(t.get("title")))
            .category(str(t.get("category"))).criticality(str(t.get("criticality"))).frequency(str(t.get("frequency")))
            .slaMinutes(intOf(t.get("slaMinutes"))).objective(str(t.get("objective")))
            .stepCount(intOf(t.get("stepCount"))).sectionCount(intOf(t.get("sectionCount"))).clauseRefs(new ArrayList<>(refs))
            .adopted(rb != null).adoptedRunbookId(rb != null ? rb.getRunbookId() : null)
            .adoptedTemplateVersion(rb != null ? rb.getSourceTemplateVer() : null)
            .updateAvailable(rb != null && ver != null && rb.getSourceTemplateVer() != null && ver > rb.getSourceTemplateVer())
            .updatedAt(updated).build();
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Integer intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        try { return o == null ? null : Integer.parseInt(String.valueOf(o)); } catch (NumberFormatException e) { return null; }
    }
}
