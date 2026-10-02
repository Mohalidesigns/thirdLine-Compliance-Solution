package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import com.atheris.compliance.tenant.backend.modules.returns.dto.FrequencyRepairPreview;
import com.atheris.compliance.tenant.backend.modules.returns.dto.FrequencyRepairResult;
import com.atheris.compliance.tenant.backend.modules.returns.entity.*;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.util.*;
import java.util.stream.Collectors;

/**
 * One-off repair of {@code regulatory_returns.frequency_type}. Seeded returns were all stored as MONTHLY
 * because the platform's seed DTO never carried the type, so every return generated monthly instances.
 *
 * <p>The proposed type comes from the matching platform return (same act id and normalised title — the
 * seed copies the platform's {@code regulationId} into {@code actId} and its {@code title} into
 * {@code returnName}), else from the tenant's own frequency text. Only {@code frequencyType} changes; the
 * frequency text is kept as written. Untouched instances of a retyped return are removed and the schedule
 * is regenerated with {@link ReturnService#ensureInstances}. Touched instances are always kept.
 */
@Service @Slf4j @RequiredArgsConstructor
public class ReturnFrequencyRepairService {

    static final String SOURCE_PLATFORM = "platform";
    static final String SOURCE_TEXT = "frequency_text";

    /** Evidence {@code source_type} values that point at a filing instance id. */
    private static final List<String> INSTANCE_EVIDENCE_TYPES = List.of("return_instance", "return_filing_instance");

    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final EvidenceFileRepository evidence;
    private final TenantRegulatorRepository tenantRegulators;
    private final TenantIdentityService tenantIdentity;
    private final PlatformApiClient platform;
    private final ReturnService returnService;
    private final AuditService audit;

    @PersistenceContext
    private EntityManager em;

    /** Dry run: what {@link #apply} would do. Never fails because the platform is unreachable. */
    public FrequencyRepairPreview preview() {
        Plan plan = plan();
        List<FrequencyRepairPreview.Item> items = plan.changes().stream()
            .map(c -> FrequencyRepairPreview.Item.builder()
                .returnId(c.ret().getReturnId())
                .returnName(c.ret().getReturnName())
                .regulator(c.ret().getFilingRegulator())
                .frequency(c.ret().getFrequency())
                .currentType(c.ret().getFrequencyType())
                .proposedType(c.proposed().name())
                .source(c.source())
                .removableInstances(c.removable().size())
                .keptInstances(c.keptCount())
                .build())
            .toList();
        return FrequencyRepairPreview.builder()
            .totalReturns(plan.totalReturns())
            .toRetype(plan.changes().size())
            .unchanged(plan.totalReturns() - plan.changes().size())
            .instancesToRemove(plan.removableCount())
            .instancesKept(plan.keptCount())
            .items(new ArrayList<>(items))
            .build();
    }

    /** Applies the repair as one unit. Idempotent: once applied, a second call finds nothing to retype. */
    @Transactional
    public FrequencyRepairResult apply(Integer userId) {
        try {
            return doApply(userId);
        } catch (Throwable t) {
            rollback();
            throw t;
        }
    }

    private FrequencyRepairResult doApply(Integer userId) {
        Plan plan = plan();
        if (plan.changes().isEmpty()) {
            log.info("Return frequency repair: nothing to retype ({} returns checked)", plan.totalReturns());
            return FrequencyRepairResult.builder().build();
        }

        List<RegulatoryReturn> retyped = new ArrayList<>();
        List<ReturnFilingInstance> removable = new ArrayList<>();
        for (Change c : plan.changes()) {
            c.ret().setFrequencyType(c.proposed().name());
            retyped.add(c.ret());
            removable.addAll(c.removable());
        }
        returns.saveAll(retyped);
        instances.deleteAll(removable);
        instances.flush();

        // Daily is left to the scheduler (5-minute maintenance); event-driven returns get no instances.
        List<RegulatoryReturn> regenerate = retyped.stream()
            .filter(r -> r.getStatus() == RegulatoryReturnStatus.ACTIVE)
            .filter(r -> !ReturnFrequency.DAILY.name().equals(r.getFrequencyType())
                && !ReturnFrequency.EVENT_DRIVEN.name().equals(r.getFrequencyType()))
            .toList();
        Set<Long> regenIds = regenerate.stream().map(RegulatoryReturn::getReturnId).collect(Collectors.toSet());
        long before = regenIds.isEmpty() ? 0 : instances.countByReturnIdIn(regenIds);
        for (RegulatoryReturn r : regenerate) returnService.ensureInstances(r);
        instances.flush();
        long after = regenIds.isEmpty() ? 0 : instances.countByReturnIdIn(regenIds);
        int created = (int) (after - before);

        List<Long> retypedIds = retyped.stream().map(RegulatoryReturn::getReturnId).sorted().toList();
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("retyped", retyped.size());
        details.put("instancesRemoved", removable.size());
        details.put("instancesKept", plan.keptCount());
        details.put("instancesCreated", created);
        details.put("platformAvailable", plan.platformAvailable());
        details.put("retypedReturnIds", retypedIds);
        audit.log(userId, "returns_frequency_repaired", "regulatory_return", null, details);

        log.info("Return frequency repair applied: {} retyped, {} instances removed, {} kept, {} created",
            retyped.size(), removable.size(), plan.keptCount(), created);
        return FrequencyRepairResult.builder()
            .retyped(retyped.size())
            .instancesRemoved(removable.size())
            .instancesKept(plan.keptCount())
            .instancesCreated(created)
            .build();
    }

    // ── planning ────────────────────────────────────────────────────────────

    private record Change(RegulatoryReturn ret, ReturnFrequency proposed, String source,
                          List<ReturnFilingInstance> removable, int keptCount) {}

    private record Plan(int totalReturns, List<Change> changes, boolean platformAvailable) {
        int removableCount() { return changes.stream().mapToInt(c -> c.removable().size()).sum(); }
        int keptCount() { return changes.stream().mapToInt(Change::keptCount).sum(); }
    }

    private record Proposal(ReturnFrequency type, String source) {}

    private Plan plan() {
        List<RegulatoryReturn> all = returns.findAll();
        PlatformIndex index = loadPlatformIndex();

        List<RegulatoryReturn> toChange = new ArrayList<>();
        Map<Long, Proposal> proposals = new HashMap<>();
        for (RegulatoryReturn r : all) {
            Proposal p = propose(r, index);
            if (p == null || p.type().name().equals(r.getFrequencyType())) continue;
            toChange.add(r);
            proposals.put(r.getReturnId(), p);
        }

        Set<Long> changeIds = proposals.keySet();
        List<ReturnFilingInstance> insts = changeIds.isEmpty() ? List.of() : instances.findByReturnIdIn(changeIds);
        Set<Long> withEvidence = instancesWithEvidence(insts);
        Map<Long, List<ReturnFilingInstance>> byReturn = insts.stream()
            .collect(Collectors.groupingBy(ReturnFilingInstance::getReturnId));

        List<Change> changes = new ArrayList<>();
        for (RegulatoryReturn r : toChange) {
            List<ReturnFilingInstance> own = byReturn.getOrDefault(r.getReturnId(), List.of());
            List<ReturnFilingInstance> removable = own.stream()
                .filter(i -> isUntouched(i, withEvidence)).toList();
            Proposal p = proposals.get(r.getReturnId());
            changes.add(new Change(r, p.type(), p.source(), removable, own.size() - removable.size()));
        }
        changes.sort(Comparator.comparing((Change c) -> c.ret().getReturnName(),
            Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)).thenComparing(c -> c.ret().getReturnId()));
        return new Plan(all.size(), changes, index.available());
    }

    /** Platform type for the matching platform return, else the tenant's own frequency text; null = no opinion. */
    private Proposal propose(RegulatoryReturn r, PlatformIndex index) {
        PlatformRegulationSeed.ReturnItem match = index.match(r);
        if (match != null) {
            Optional<ReturnFrequency> t = platformType(match);
            if (t.isPresent()) return new Proposal(t.get(), SOURCE_PLATFORM);
        }
        return ReturnFrequency.classify(r.getFrequency())
            .map(t -> new Proposal(t, SOURCE_TEXT))
            .orElse(null);
    }

    /**
     * The platform's full frequency text classified with the tenant classifier, which is stricter than
     * intel's {@code ToolkitImportService.classifyFrequency} (leading cycle words and period-end anchors
     * beat "within"; no MONTHLY default). The platform's stored {@code frequencyType} is used only when
     * the text yields nothing — and not when it is MONTHLY, since for unrecognised text that is only
     * intel's default and carries no information.
     */
    private static Optional<ReturnFrequency> platformType(PlatformRegulationSeed.ReturnItem p) {
        Optional<ReturnFrequency> fromText = ReturnFrequency.classify(p.getFrequency());
        if (fromText.isPresent()) return fromText;
        return ReturnFrequency.fromCode(p.getFrequencyType()).filter(t -> t != ReturnFrequency.MONTHLY);
    }

    /**
     * An instance is untouched when nothing a user can write has been written to it:
     * status Not Started, stage Not Started, no stage owner, no stage data (advance/submit history),
     * no submitted date / submitter / submission evidence URL, no notes, no days-late figure, and no
     * evidence file attached to it ({@code evidence_files.source_type} return_instance). The system-written
     * escalation fields ({@code escalation_level}, {@code escalated_at}) and {@code filing_channel}
     * (copied from the return at creation) are ignored.
     */
    private static boolean isUntouched(ReturnFilingInstance i, Set<Long> withEvidence) {
        return (i.getStatus() == null || i.getStatus() == ReturnFilingStatus.NOT_STARTED)
            && (i.getCurrentStage() == null || i.getCurrentStage() == ReturnStage.NOT_STARTED)
            && i.getStageOwnerUserId() == null
            && isBlankJson(i.getStageData())
            && i.getSubmittedDate() == null
            && i.getSubmittedByUserId() == null
            && isBlank(i.getSubmissionEvidenceUrl())
            && isBlank(i.getNotes())
            && (i.getDaysLate() == null || i.getDaysLate() == 0)
            && !withEvidence.contains(i.getInstanceId());
    }

    private Set<Long> instancesWithEvidence(List<ReturnFilingInstance> insts) {
        if (insts.isEmpty()) return Set.of();
        Set<Long> ids = insts.stream().map(ReturnFilingInstance::getInstanceId).collect(Collectors.toSet());
        return evidence.findBySourceTypeInAndSourceIdIn(INSTANCE_EVIDENCE_TYPES, ids).stream()
            .map(EvidenceFile::getSourceId).collect(Collectors.toSet());
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    private static boolean isBlankJson(String s) {
        if (s == null) return true;
        String t = s.replaceAll("\\s+", "");
        return t.isEmpty() || t.equals("{}") || t.equals("null");
    }

    // ── platform source of truth ────────────────────────────────────────────

    /** Platform returns keyed by act id + normalised title, and by normalised act name + title as fallback. */
    private record PlatformIndex(Map<String, PlatformRegulationSeed.ReturnItem> byActId,
                                 Map<String, PlatformRegulationSeed.ReturnItem> byActName,
                                 boolean available) {
        static PlatformIndex empty() { return new PlatformIndex(Map.of(), Map.of(), false); }

        PlatformRegulationSeed.ReturnItem match(RegulatoryReturn r) {
            String name = norm(r.getReturnName());
            if (name.isEmpty()) return null;
            PlatformRegulationSeed.ReturnItem hit = r.getActId() != null ? byActId.get(r.getActId() + "|" + name) : null;
            if (hit == null && !norm(r.getActName()).isEmpty()) hit = byActName.get(norm(r.getActName()) + "|" + name);
            return hit;
        }
    }

    private PlatformIndex loadPlatformIndex() {
        try {
            Long tenantId = tenantIdentity.currentTenantId();
            List<Integer> platformIds = tenantRegulators.findByTenantIdAndIsActiveTrue(tenantId).stream()
                .map(TenantRegulator::getPlatformRegulatorId)
                .filter(Objects::nonNull).distinct().sorted().toList();
            if (platformIds.isEmpty()) {
                log.warn("Return frequency repair: no platform-linked regulators — classifying all returns from their frequency text");
                return PlatformIndex.empty();
            }
            // fetchRegulationSeeds swallows errors and returns an empty list, so empty = unavailable.
            List<PlatformRegulationSeed> bundles = platform.fetchRegulationSeeds(platformIds);
            if (bundles == null || bundles.isEmpty()) {
                log.warn("Return frequency repair: platform seed unavailable or empty — classifying all returns from their frequency text");
                return PlatformIndex.empty();
            }
            Map<String, PlatformRegulationSeed.ReturnItem> byActId = new HashMap<>();
            Map<String, PlatformRegulationSeed.ReturnItem> byActName = new HashMap<>();
            for (PlatformRegulationSeed b : bundles) {
                if (b.getReturns() == null) continue;
                String actName = norm(b.getRegulationName());
                for (PlatformRegulationSeed.ReturnItem rt : b.getReturns()) {
                    String title = norm(rt.getTitle());
                    if (title.isEmpty()) continue;
                    if (b.getRegulationId() != null) byActId.putIfAbsent(b.getRegulationId() + "|" + title, rt);
                    if (!actName.isEmpty()) byActName.putIfAbsent(actName + "|" + title, rt);
                }
            }
            log.info("Return frequency repair: {} platform returns indexed from {} regulation bundles",
                byActId.size(), bundles.size());
            return new PlatformIndex(byActId, byActName, true);
        } catch (Throwable t) {
            log.warn("Return frequency repair: platform lookup failed ({}) — classifying all returns from their frequency text",
                t.getMessage());
            return PlatformIndex.empty();
        }
    }

    /** Lower-case, punctuation-insensitive, single-spaced. */
    private static String norm(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    private void rollback() {
        try {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        } catch (Throwable ignored) {
            // no active transaction
        }
        em.clear();
    }
}
