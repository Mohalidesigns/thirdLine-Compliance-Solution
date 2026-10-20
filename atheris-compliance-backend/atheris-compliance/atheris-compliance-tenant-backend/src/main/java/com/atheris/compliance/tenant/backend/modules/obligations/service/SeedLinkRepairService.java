package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.common.obligations.ObligationKey;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.evidence.entity.EvidenceFile;
import com.atheris.compliance.tenant.backend.modules.evidence.repository.EvidenceFileRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ClassificationHistory;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ClassificationHistoryRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationSanctionRepository;
import com.atheris.compliance.tenant.backend.modules.runbooks.entity.Runbook;
import com.atheris.compliance.tenant.backend.modules.runbooks.repository.RunbookRepository;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Repairs seeded data that the old toolkit import / tenant seed got wrong (idempotent; run by
 * {@link SeedDataRepairService} inside its transaction):
 * <ol>
 *   <li><b>Duplicate obligations</b> — the toolkit repeated rows on the generic CRMP sheet, so
 *       pairs of seeded obligations share instrument + {@link ObligationKey}. One is kept (the one a
 *       user has worked on, else the platform's surviving copy, else the lowest id); every reference
 *       to the other — return and sanction links, findings, classification history, runbooks,
 *       evidence, control links — moves to the kept row before it is deleted. A group in which two
 *       rows were both edited is left alone.</li>
 *   <li><b>Control links</b> — the seed linked every control to every obligation of its act and
 *       added the platform's (untranslated) ids. A seeded control whose links are still that act-wide
 *       set gets the platform's row-of-origin links instead; other controls only lose ids that point
 *       to no obligation. Then both sides are made to agree: an obligation still carrying its act's
 *       full control set takes the control side; any other obligation keeps its own links, which are
 *       mirrored onto the controls.</li>
 * </ol>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SeedLinkRepairService {

    private final ObligationRepository obligationRepo;
    private final ObligationClassificationRepository classifications;
    private final ClassificationHistoryRepository history;
    private final ObligationSanctionRepository obligationSanctions;
    private final ControlRepository controlRepo;
    private final FindingRepository findings;
    private final RunbookRepository runbooks;
    private final EvidenceFileRepository evidence;

    public record Result(int duplicatesMerged, int duplicateGroupsSkipped, int controlsRelinked, int obligationsRelinked) {}

    public Result repair(List<PlatformRegulationSeed> bundles) {
        int[] merged = mergeDuplicates(bundles);
        // Platform ids are needed to translate the row-of-origin links; an older platform does not
        // send them, and relinking without them would strip every seeded control.
        boolean platformIds = bundles.stream().filter(b -> b.getObligations() != null)
            .flatMap(b -> b.getObligations().stream()).anyMatch(o -> o.getObligationId() != null);
        if (!platformIds) {
            log.warn("[SeedLinkRepair] platform sends no obligation ids yet — control links left as they are");
            return new Result(merged[0], merged[1], 0, 0);
        }
        int[] relinked = relink(bundles);
        return new Result(merged[0], merged[1], relinked[0], relinked[1]);
    }

    // ── 1. duplicate obligations ────────────────────────────────────────────

    /** {rows merged away, groups skipped}. */
    int[] mergeDuplicates(List<PlatformRegulationSeed> bundles) {
        List<Obligation> seeded = obligationRepo.findBySource(SeedDataRepairService.SEEDED);
        Map<String, List<Obligation>> groups = new LinkedHashMap<>();
        for (Obligation o : seeded) {
            String k = SeedLinks.key(o);
            if (k != null && o.getInstrumentId() != null)
                groups.computeIfAbsent(o.getInstrumentId() + "#" + k, x -> new ArrayList<>()).add(o);
        }
        groups.values().removeIf(g -> g.size() < 2);
        if (groups.isEmpty()) return new int[] { 0, 0 };

        Set<Long> involved = groups.values().stream().flatMap(List::stream).map(Obligation::getObligationId)
            .collect(Collectors.toSet());
        Map<Long, ObligationClassification> clsByObligation = classifications.findByObligationIdIn(involved).stream()
            .collect(Collectors.toMap(ObligationClassification::getObligationId, Function.identity(), (a, b) -> a));
        Set<Long> withHistory = history.findByObligationIdIn(involved).stream()
            .map(ClassificationHistory::getObligationId).collect(Collectors.toSet());
        Set<String> platformSignatures = platformSignatures(bundles);

        Map<Long, Long> loserToKeeper = new LinkedHashMap<>();
        int skipped = 0;
        for (List<Obligation> group : groups.values()) {
            Obligation keep = chooseKeeper(group, clsByObligation, withHistory, platformSignatures);
            if (keep == null) {
                skipped++;
                log.warn("[SeedLinkRepair] duplicate obligations {} were each edited — left for a person to merge",
                    group.stream().map(Obligation::getObligationId).toList());
                continue;
            }
            for (Obligation o : group) if (o != keep) loserToKeeper.put(o.getObligationId(), keep.getObligationId());
        }
        if (loserToKeeper.isEmpty()) return new int[] { 0, skipped };
        moveReferences(loserToKeeper, clsByObligation);

        List<ObligationClassification> loserCls = loserToKeeper.keySet().stream()
            .map(clsByObligation::get).filter(Objects::nonNull).toList();
        classifications.deleteAll(loserCls);
        obligationRepo.deleteAllById(loserToKeeper.keySet());
        return new int[] { loserToKeeper.size(), skipped };
    }

    /**
     * The edited row when exactly one was edited; none (null) when several were; otherwise the copy
     * matching the platform's surviving obligation, else the lowest id.
     */
    static Obligation chooseKeeper(List<Obligation> group, Map<Long, ObligationClassification> cls,
                                   Set<Long> withHistory, Set<String> platformSignatures) {
        List<Obligation> edited = group.stream().filter(o -> {
            ObligationClassification c = cls.get(o.getObligationId());
            return withHistory.contains(o.getObligationId())
                || (c != null && c.getClassificationVersion() != null && c.getClassificationVersion() > 1);
        }).toList();
        if (edited.size() > 1) return null;
        if (edited.size() == 1) return edited.get(0);
        Comparator<Obligation> byId = Comparator.comparing(Obligation::getObligationId);
        return group.stream()
            .filter(o -> platformSignatures.contains(o.getInstrumentId() + "#" + signature(o.getPlainEnglishStatement(), o.getSectionReference())))
            .min(byId)
            .orElseGet(() -> group.stream().min(byId).orElseThrow());
    }

    private static Set<String> platformSignatures(List<PlatformRegulationSeed> bundles) {
        Set<String> out = new HashSet<>();
        for (PlatformRegulationSeed b : bundles) {
            if (b.getCanonicalInstrument() == null || b.getObligations() == null) continue;
            Long inst = b.getCanonicalInstrument().getInstrumentId();
            for (PlatformRegulationSeed.ObligationItem o : b.getObligations())
                out.add(inst + "#" + signature(o.getPlainEnglishStatement(), o.getSpecificSectionReference()));
        }
        return out;
    }

    private static String signature(String plain, String section) {
        return ObligationKey.normalize(plain) + '|' + ObligationKey.normalizeSection(section);
    }

    private void moveReferences(Map<Long, Long> loserToKeeper, Map<Long, ObligationClassification> clsByObligation) {
        Set<Long> losers = loserToKeeper.keySet();
        loserToKeeper.forEach((loser, keeper) -> {
            Set<Long> keeperReturns = new HashSet<>(obligationRepo.findLinkedReturnIds(keeper));
            for (Long returnId : obligationRepo.findLinkedReturnIds(loser))
                if (keeperReturns.add(returnId)) obligationRepo.insertReturnLink(keeper, returnId);
            obligationRepo.deleteReturnLinks(loser);
            for (Long sanctionId : obligationSanctions.findLinkedSanctionIds(loser))
                obligationSanctions.insertSanctionLink(keeper, sanctionId);
            obligationSanctions.deleteByObligationId(loser);

            // the loser's control links join the keeper's (the relink step then settles both sides)
            ObligationClassification lc = clsByObligation.get(loser);
            ObligationClassification kc = clsByObligation.get(keeper);
            if (lc != null && kc != null && lc.getLinkedControlIds() != null) {
                List<Integer> ids = kc.getLinkedControlIds() == null ? new ArrayList<>() : new ArrayList<>(kc.getLinkedControlIds());
                for (Integer id : lc.getLinkedControlIds()) if (!ids.contains(id)) ids.add(id);
                kc.setLinkedControlIds(ids);
                classifications.save(kc);
            }
        });

        List<Finding> movedFindings = findings.findByLinkedObligationIdIn(losers);
        movedFindings.forEach(f -> f.setLinkedObligationId(loserToKeeper.get(f.getLinkedObligationId())));
        findings.saveAll(movedFindings);

        List<ClassificationHistory> movedHistory = history.findByObligationIdIn(losers);
        movedHistory.forEach(h -> h.setObligationId(loserToKeeper.get(h.getObligationId())));
        history.saveAll(movedHistory);

        List<EvidenceFile> movedEvidence = evidence.findBySourceTypeInAndSourceIdIn(List.of("obligation"), losers);
        movedEvidence.forEach(e -> e.setSourceId(loserToKeeper.get(e.getSourceId())));
        evidence.saveAll(movedEvidence);

        List<Runbook> movedRunbooks = new ArrayList<>();
        for (Runbook r : runbooks.findAll()) {
            List<Long> replaced = replaceIds(r.getLinkedObligationIds(), loserToKeeper);
            if (replaced != null) { r.setLinkedObligationIds(replaced); movedRunbooks.add(r); }
        }
        runbooks.saveAll(movedRunbooks);

        List<Control> movedControls = new ArrayList<>();
        for (Control c : controlRepo.findAll()) {
            List<Long> replaced = replaceIds(c.getLinkedObligationIds(), loserToKeeper);
            if (replaced != null) { c.setLinkedObligationIds(replaced); movedControls.add(c); }
        }
        controlRepo.saveAll(movedControls);
    }

    /** The list with merged ids replaced by their keeper (deduplicated), or null when nothing changed. */
    static List<Long> replaceIds(List<Long> ids, Map<Long, Long> loserToKeeper) {
        if (ids == null || ids.stream().noneMatch(loserToKeeper::containsKey)) return null;
        return new ArrayList<>(ids.stream().map(id -> loserToKeeper.getOrDefault(id, id))
            .collect(Collectors.toCollection(LinkedHashSet::new)));
    }

    // ── 2. control links ────────────────────────────────────────────────────

    /** {controls changed, classifications changed}. */
    int[] relink(List<PlatformRegulationSeed> bundles) {
        List<Control> allControls = controlRepo.findAll();
        Set<Long> obligationIds = new HashSet<>(obligationRepo.findAll().stream().map(Obligation::getObligationId).toList());
        Map<String, Control> controlByNumber = allControls.stream().filter(c -> c.getControlNumber() != null)
            .collect(Collectors.toMap(Control::getControlNumber, Function.identity(), (a, b) -> a));
        Set<Control> changedControls = Collections.newSetFromMap(new IdentityHashMap<>());

        // Seeded controls per instrument, and their platform links translated to tenant ids.
        Map<Long, Set<Integer>> seededControlsByInstrument = new HashMap<>();
        Map<Integer, List<Long>> platformLinks = new HashMap<>();
        Map<Integer, Set<Long>> instrumentObligationsOfControl = new HashMap<>();
        for (PlatformRegulationSeed b : bundles) {
            if (b.getCanonicalInstrument() == null || b.getCanonicalInstrument().getInstrumentId() == null
                || b.getControls() == null) continue;
            Long instrumentId = b.getCanonicalInstrument().getInstrumentId();
            List<Obligation> instObligations = obligationRepo.findByInstrumentId(instrumentId);
            Set<Long> instIds = instObligations.stream().map(Obligation::getObligationId).collect(Collectors.toSet());
            Map<Long, Long> p2t = SeedLinks.platformToTenant(b.getObligations(), instObligations);
            for (PlatformRegulationSeed.ControlItem item : b.getControls()) {
                Control c = item.getControlNumber() == null ? null : controlByNumber.get(item.getControlNumber());
                if (c == null) continue;
                seededControlsByInstrument.computeIfAbsent(instrumentId, x -> new HashSet<>()).add(c.getControlId());
                platformLinks.put(c.getControlId(), SeedLinks.translate(item.getLinkedObligationIds(), p2t));
                instrumentObligationsOfControl.put(c.getControlId(), instIds);
            }
        }

        // Control side: act-wide → platform links; otherwise drop ids with no obligation.
        for (Control c : allControls) {
            List<Long> current = c.getLinkedObligationIds() == null ? List.of() : c.getLinkedObligationIds();
            Set<Long> existing = current.stream().filter(obligationIds::contains).collect(Collectors.toCollection(LinkedHashSet::new));
            Set<Long> instIds = instrumentObligationsOfControl.get(c.getControlId());
            List<Long> next = instIds != null && !instIds.isEmpty() && existing.equals(instIds)
                ? platformLinks.get(c.getControlId())
                : new ArrayList<>(existing);
            // compare as sets: the same links in another order are not a change (keeps the repair idempotent)
            if (!new HashSet<>(next).equals(new HashSet<>(current)) || next.size() != current.size()) {
                c.setLinkedObligationIds(new ArrayList<>(next));
                changedControls.add(c);
            }
        }

        // Obligation side.
        Set<Integer> controlIds = allControls.stream().map(Control::getControlId).collect(Collectors.toSet());
        Map<Long, Set<Integer>> fromControls = new HashMap<>();
        for (Control c : allControls)
            if (c.getLinkedObligationIds() != null)
                for (Long o : c.getLinkedObligationIds()) fromControls.computeIfAbsent(o, x -> new LinkedHashSet<>()).add(c.getControlId());
        Map<Integer, Control> controlById = allControls.stream().collect(Collectors.toMap(Control::getControlId, Function.identity()));

        List<ObligationClassification> changedCls = new ArrayList<>();
        Set<Long> withClassification = new HashSet<>();
        for (ObligationClassification cls : classifications.findAll()) {
            if (cls.getObligationId() == null) continue;
            withClassification.add(cls.getObligationId());
            List<Integer> current = cls.getLinkedControlIds() == null ? List.of() : cls.getLinkedControlIds();
            Set<Integer> valid = current.stream().filter(controlIds::contains).collect(Collectors.toCollection(LinkedHashSet::new));
            Set<Integer> mirrored = fromControls.getOrDefault(cls.getObligationId(), Set.of());
            Set<Integer> actControls = cls.getInstrumentId() == null ? null : seededControlsByInstrument.get(cls.getInstrumentId());
            Set<Integer> next = new LinkedHashSet<>();
            if (actControls != null && !actControls.isEmpty() && valid.equals(actControls)) {
                next.addAll(mirrored);                      // the act-wide set: take the control side
            } else {
                next.addAll(valid);                         // the obligation's own links stay …
                next.addAll(mirrored);
                for (Integer cid : valid) {                 // … and are mirrored onto the controls
                    Control c = controlById.get(cid);
                    List<Long> ids = c.getLinkedObligationIds() == null ? new ArrayList<>() : new ArrayList<>(c.getLinkedObligationIds());
                    if (!ids.contains(cls.getObligationId())) {
                        ids.add(cls.getObligationId());
                        c.setLinkedObligationIds(ids);
                        changedControls.add(c);
                    }
                }
            }
            if (!next.equals(new HashSet<>(current)) || next.size() != current.size()) {
                cls.setLinkedControlIds(new ArrayList<>(next));
                changedCls.add(cls);
            }
        }
        controlRepo.saveAll(changedControls);
        classifications.saveAll(changedCls);
        long orphanLinks = fromControls.keySet().stream().filter(o -> !withClassification.contains(o)).count();
        if (orphanLinks > 0)
            log.info("[SeedLinkRepair] {} linked obligations have no classification row (control side only)", orphanLinks);
        return new int[] { changedControls.size(), changedCls.size() };
    }
}
