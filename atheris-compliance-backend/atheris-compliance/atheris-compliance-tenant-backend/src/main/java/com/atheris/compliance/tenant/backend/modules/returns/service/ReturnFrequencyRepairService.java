package com.atheris.compliance.tenant.backend.modules.returns.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
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
 * One-off repair of a return's schedule: its {@code frequency_type} and, for platform-seeded returns, its
 * due-date rule.
 *
 * <p><b>Type.</b> Seeded returns were all stored as MONTHLY because the platform's seed DTO never carried the
 * type. The proposed type comes from the matching platform return (same act id and normalised title — the seed
 * copies the platform's {@code regulationId} into {@code actId} and its {@code title} into {@code returnName}),
 * else from the tenant's own frequency text. The frequency text is kept as written.
 *
 * <p><b>Due rule.</b> For a platform-matched return whose rule was not set by a person
 * ({@code due_date_source != 'user'}), the rule is re-derived from the platform's deadline wording with
 * {@link ReturnDeadlineParser} under the proposed type. It changes when its canonical form differs (offset
 * days; an anchor's first occurrence in the cycle — raw dates are never compared, since seeded
 * {@code filing_date}s are artifacts), or when a rule-less return still has legacy "due the 1st" periods.
 * No parsable deadline → no rule ("Due date needed"). No platform match / platform unavailable → no rule
 * proposal. {@code deadline_text} is backfilled for matched returns without counting as a change.
 *
 * <p>One item per return. Untouched instances of a changed return are removed once and the schedule is
 * regenerated once with {@link ReturnService#ensureInstances}. Touched instances are always kept. Idempotent.
 */
@Service @Slf4j @RequiredArgsConstructor
public class ReturnFrequencyRepairService {

    static final String SOURCE_PLATFORM = "platform";
    static final String SOURCE_TEXT = "frequency_text";

    private final RegulatoryReturnRepository returns;
    private final ReturnFilingInstanceRepository instances;
    private final UntouchedInstances untouched;
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
                .proposedType(c.proposedType().name())
                .source(c.source())
                .removableInstances(c.removable().size())
                .keptInstances(c.keptCount())
                .currentRule(c.currentRuleText())
                .proposedRule(c.proposedRuleText())
                .deadlineText(c.deadlineText())
                .ruleChanged(c.ruleChanged())
                .typeChanged(c.typeChanged())
                .build())
            .toList();
        return FrequencyRepairPreview.builder()
            .totalReturns(plan.totalReturns())
            .toRetype((int) plan.changes().stream().filter(Change::typeChanged).count())
            .toReschedule((int) plan.changes().stream().filter(Change::ruleChanged).count())
            .unchanged(plan.totalReturns() - plan.changes().size())
            .instancesToRemove(plan.removableCount())
            .instancesKept(plan.keptCount())
            .items(new ArrayList<>(items))
            .build();
    }

    /** Applies the repair as one unit. Idempotent: once applied, a second call finds nothing to change. */
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
        if (!plan.backfills().isEmpty()) {
            for (Backfill b : plan.backfills()) {
                if (b.deadlineText() != null) b.ret().setDeadlineText(b.deadlineText());
                if (b.markPlatformSource()) b.ret().setDueDateSource(DueRule.SOURCE_PLATFORM_TEXT);
            }
            returns.saveAll(plan.backfills().stream().map(Backfill::ret).toList());
        }
        if (plan.changes().isEmpty()) {
            log.info("Return schedule repair: nothing to change ({} returns checked, {} backfilled)",
                plan.totalReturns(), plan.backfills().size());
            return FrequencyRepairResult.builder().build();
        }

        List<RegulatoryReturn> changed = new ArrayList<>();
        List<ReturnFilingInstance> removable = new ArrayList<>();
        int retyped = 0, rescheduled = 0;
        for (Change c : plan.changes()) {
            RegulatoryReturn r = c.ret();
            if (c.typeChanged()) {
                r.setFrequencyType(c.proposedType().name());
                retyped++;
            }
            if (c.ruleChanged()) {
                DueRule rule = c.proposedRule();
                r.setFilingDate(rule != null && rule.kind() == DueRule.Kind.DATE ? rule.firstDueDate() : null);
                r.setDueDaysAfterPeriodEnd(rule != null && rule.kind() == DueRule.Kind.OFFSET ? rule.daysAfterPeriodEnd() : null);
                r.setDueDateSource(rule != null ? DueRule.SOURCE_PLATFORM_TEXT : null);
                rescheduled++;
            }
            if (c.deadlineText() != null) r.setDeadlineText(c.deadlineText());
            changed.add(r);
            removable.addAll(c.removable());
        }
        returns.saveAll(changed);
        instances.deleteAll(removable);
        instances.flush();

        // Daily is left to the scheduler (5-minute maintenance); event-driven returns get no instances.
        List<RegulatoryReturn> regenerate = changed.stream()
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

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("retyped", retyped);
        details.put("rescheduled", rescheduled);
        details.put("instancesRemoved", removable.size());
        details.put("instancesKept", plan.keptCount());
        details.put("instancesCreated", created);
        details.put("platformAvailable", plan.platformAvailable());
        details.put("retypedReturnIds", plan.changes().stream().filter(Change::typeChanged)
            .map(c -> c.ret().getReturnId()).sorted().toList());
        details.put("rescheduledReturnIds", plan.changes().stream().filter(Change::ruleChanged)
            .map(c -> c.ret().getReturnId()).sorted().toList());
        audit.log(userId, "returns_frequency_repaired", "regulatory_return", null, details);

        log.info("Return schedule repair applied: {} retyped, {} rescheduled, {} instances removed, {} kept, {} created",
            retyped, rescheduled, removable.size(), plan.keptCount(), created);
        return FrequencyRepairResult.builder()
            .retyped(retyped)
            .rescheduled(rescheduled)
            .instancesRemoved(removable.size())
            .instancesKept(plan.keptCount())
            .instancesCreated(created)
            .build();
    }

    // ── planning ────────────────────────────────────────────────────────────

    private record Change(RegulatoryReturn ret, ReturnFrequency proposedType, String source,
                          boolean typeChanged, boolean ruleChanged, DueRule proposedRule, String deadlineText,
                          String currentRuleText, String proposedRuleText,
                          List<ReturnFilingInstance> removable, int keptCount) {}

    /** A matched return whose deadline text / source is filled in without changing its schedule. */
    private record Backfill(RegulatoryReturn ret, String deadlineText, boolean markPlatformSource) {}

    private record Plan(int totalReturns, List<Change> changes, List<Backfill> backfills, boolean platformAvailable) {
        int removableCount() { return changes.stream().mapToInt(c -> c.removable().size()).sum(); }
        int keptCount() { return changes.stream().mapToInt(Change::keptCount).sum(); }
    }

    private record Proposal(ReturnFrequency type, String source) {}

    /** The due-rule part of a candidate: what the platform text says, when the return is eligible. */
    private record RuleProposal(DueRule rule, String deadlineText) {}

    private Plan plan() {
        List<RegulatoryReturn> all = returns.findAll();
        PlatformIndex index = loadPlatformIndex();

        // Pass 1: type proposals and platform rule proposals (no instance data needed yet).
        Map<Long, Proposal> typeProposals = new HashMap<>();
        Map<Long, RuleProposal> ruleProposals = new HashMap<>();
        for (RegulatoryReturn r : all) {
            PlatformRegulationSeed.ReturnItem match = index.match(r);
            Proposal p = propose(r, match);
            if (p != null && !p.type().name().equals(r.getFrequencyType())) typeProposals.put(r.getReturnId(), p);
            if (match != null && !DueRule.SOURCE_USER.equals(r.getDueDateSource())) {
                ReturnFrequency type = effectiveType(r, typeProposals.get(r.getReturnId()));
                Optional<ReturnDeadlineParser.Parsed> parsed = ReturnDeadlineParser.parsePlatform(match, type);
                ruleProposals.put(r.getReturnId(), new RuleProposal(
                    parsed.map(ReturnDeadlineParser.Parsed::rule).orElse(null),
                    ReturnDeadlineParser.deadlineText(match, parsed)));
            }
        }

        Set<Long> candidateIds = new HashSet<>(typeProposals.keySet());
        candidateIds.addAll(ruleProposals.keySet());
        List<ReturnFilingInstance> insts = candidateIds.isEmpty() ? List.of() : instances.findByReturnIdIn(candidateIds);
        Set<Long> withEvidence = untouched.withEvidence(insts);
        Map<Long, List<ReturnFilingInstance>> byReturn = insts.stream()
            .collect(Collectors.groupingBy(ReturnFilingInstance::getReturnId));

        // Pass 2: decide per return.
        List<Change> changes = new ArrayList<>();
        List<Backfill> backfills = new ArrayList<>();
        for (RegulatoryReturn r : all) {
            if (!candidateIds.contains(r.getReturnId())) continue;
            List<ReturnFilingInstance> own = byReturn.getOrDefault(r.getReturnId(), List.of());
            List<ReturnFilingInstance> removable = own.stream()
                .filter(i -> UntouchedInstances.isUntouched(i, withEvidence)).toList();

            Proposal tp = typeProposals.get(r.getReturnId());
            ReturnFrequency currentType = DueRule.typeOf(r);
            ReturnFrequency type = effectiveType(r, tp);
            DueRule current = rawRule(r);

            RuleProposal rp = ruleProposals.get(r.getReturnId());
            boolean ruleChanged = false;
            if (rp != null) {
                String cur = current != null ? current.canonical(type) : null;
                String prop = rp.rule() != null ? rp.rule().canonical(type) : null;
                // Rule-less but still carrying legacy "due the 1st" periods from before rules existed.
                boolean legacy = current == null && rp.rule() == null
                    && DueRule.stepMonths(type) > 0 && !removable.isEmpty();
                ruleChanged = !Objects.equals(cur, prop) || legacy;
            }
            boolean typeChanged = tp != null;

            if (!typeChanged && !ruleChanged) {
                if (rp != null) {
                    boolean textDiffers = rp.deadlineText() != null && !rp.deadlineText().equals(r.getDeadlineText());
                    boolean markSource = rp.rule() != null && r.getDueDateSource() == null;
                    if (textDiffers || markSource)
                        backfills.add(new Backfill(r, textDiffers ? rp.deadlineText() : null, markSource));
                }
                continue;
            }

            DueRule proposed = ruleChanged ? rp.rule() : current;
            String currentText = current != null ? current.describe(currentType)
                : DueRule.describeNone(currentType, !own.isEmpty());
            String proposedText = proposed != null ? proposed.describe(type) : DueRule.describeNone(type, false);
            changes.add(new Change(r, type, typeChanged ? tp.source() : SOURCE_PLATFORM,
                typeChanged, ruleChanged, ruleChanged ? rp.rule() : null,
                rp != null ? rp.deadlineText() : r.getDeadlineText(),
                currentText, proposedText, removable, own.size() - removable.size()));
        }
        changes.sort(Comparator.comparing((Change c) -> c.ret().getReturnName(),
            Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)).thenComparing(c -> c.ret().getReturnId()));
        return new Plan(all.size(), changes, backfills, index.available());
    }

    private static ReturnFrequency effectiveType(RegulatoryReturn r, Proposal typeProposal) {
        return typeProposal != null ? typeProposal.type() : DueRule.typeOf(r);
    }

    /** The stored rule regardless of type: offset days, else the anchor, else none. */
    private static DueRule rawRule(RegulatoryReturn r) {
        if (r.getDueDaysAfterPeriodEnd() != null) return DueRule.offset(r.getDueDaysAfterPeriodEnd());
        if (r.getFilingDate() != null) return DueRule.date(r.getFilingDate());
        return null;
    }

    /** Platform type for the matching platform return, else the tenant's own frequency text; null = no opinion. */
    private Proposal propose(RegulatoryReturn r, PlatformRegulationSeed.ReturnItem match) {
        if (match != null) {
            Optional<ReturnFrequency> t = ReturnDeadlineParser.platformType(match);
            if (t.isPresent()) return new Proposal(t.get(), SOURCE_PLATFORM);
        }
        return ReturnFrequency.classify(r.getFrequency())
            .map(t -> new Proposal(t, SOURCE_TEXT))
            .orElse(null);
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
