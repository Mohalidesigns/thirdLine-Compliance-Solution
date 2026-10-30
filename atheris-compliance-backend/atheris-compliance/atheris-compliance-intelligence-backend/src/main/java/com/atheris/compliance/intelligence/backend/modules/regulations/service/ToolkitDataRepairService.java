package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.common.obligations.ObligationKey;
import com.atheris.compliance.common.returns.ReturnFrequencyClassifier;
import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.common.taxonomy.AreasOfFocus;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.seed.ToolkitSeedDoc;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulatoryReturn;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.ComplianceControlRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulatoryReturnRepository;
import com.atheris.compliance.intelligence.backend.shared.text.TextCleaner;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Brings already-imported toolkit rows in line with the current import rules (idempotent — a
 * second run changes nothing):
 * <ul>
 *   <li>obligation inherent risk re-banded from its stored likelihood × impact with the canonical
 *       cut-offs ({@link RiskBands}); the old 3×3 cut-offs made High × Medium "Critical";</li>
 *   <li>obligation area inherited from its instrument, else its section area on universe names;
 *       the generic CRMP sheet name is no longer an area ({@link AreasOfFocus});</li>
 *   <li>instrument area spelling variants folded onto one name;</li>
 *   <li>control risk re-banded: {@code residualRiskRating} from the row's own residual likelihood ×
 *       impact; {@code riskLevel} (inherent) from the toolkit seed JSON row the control came from,
 *       because the control row does not store its inherent likelihood × impact. Either is changed
 *       only while it still equals the old band, so an admin's rating is kept;</li>
 *   <li>duplicate obligations removed: the same row appears on the generic {@code crmp} sheet and
 *       on a topical sheet; one row per act + {@link ObligationKey} is kept (the topical copy);</li>
 *   <li>control → obligation links rebuilt from the row each control came from (its Primary or
 *       Additional Control cell), instead of a section-substring match across the whole act.</li>
 * </ul>
 * Toolkit seed rows only — AI-extracted obligations keep the classifier's values.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ToolkitDataRepairService {

    static final String TOOLKIT_SEED = "toolkit_seed";
    private static final String SEED_JSON = "classpath:toolkit/compliance_toolkits.json";

    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final ComplianceControlRepository controls;
    private final RegulatoryReturnRepository returns;
    private final ObjectMapper mapper;

    public record Result(int instrumentsUpdated, int riskRebanded, int areaReassigned,
                         int controlRiskRebanded, int controlResidualRebanded,
                         int duplicatesRemoved, int controlsRelinked, int returnsRetyped) {}

    /** Inherent likelihood × impact of the seed row a control was created from. */
    record Inherent(String likelihood, String impact) {}

    @Transactional
    public Result repair() {
        try {
            List<Instrument> toolkit = instruments.findByUploadSource(TOOLKIT_SEED);
            List<Instrument> changedInstruments = new ArrayList<>();
            for (Instrument i : toolkit) {
                String area = AreasOfFocus.canonical(i.getAreaOfFocus());
                if (!Objects.equals(area, i.getAreaOfFocus())) {
                    i.setAreaOfFocus(area);
                    changedInstruments.add(i);
                }
            }
            instruments.saveAll(changedInstruments);

            Map<Long, Instrument> byId = toolkit.stream()
                .collect(Collectors.toMap(Instrument::getInstrumentId, Function.identity()));
            int rebanded = 0;
            int reassigned = 0;
            List<ObligationMapping> changed = new ArrayList<>();
            for (ObligationMapping o : obligations.findByInstrumentIdIn(byId.keySet())) {
                boolean dirty = false;
                String band = RiskBands.band(o.getInherentLikelihood(), o.getInherentImpact());
                if (band != null && !band.equals(o.getInherentRiskRating())) {
                    o.setInherentRiskRating(band);
                    rebanded++;
                    dirty = true;
                }
                String area = AreasOfFocus.forObligation(byId.get(o.getInstrumentId()).getAreaOfFocus(), o.getAreaOfFocus());
                if (!Objects.equals(area, o.getAreaOfFocus())) {
                    o.setAreaOfFocus(area);
                    reassigned++;
                    dirty = true;
                }
                if (dirty) changed.add(o);
            }
            obligations.saveAll(changed);

            Map<String, List<ToolkitSeedDoc.ObligationRow>> sections = seedSections();
            int[] controlCounts = repairControls(inherentByControlKey(sections));
            int removed = removeDuplicateObligations(byId.keySet(), sections);
            int relinked = relinkControls(sections);
            int returnsRetyped = repairReturnFrequencies();

            Result r = new Result(changedInstruments.size(), rebanded, reassigned, controlCounts[0], controlCounts[1],
                removed, relinked, returnsRetyped);
            log.info("[ToolkitRepair] instruments area-normalised={}, obligations risk re-banded={}, area reassigned={}, "
                    + "controls risk re-banded={}, controls residual re-banded={}, duplicate obligations removed={}, "
                    + "controls relinked={}, returns re-typed={}",
                r.instrumentsUpdated(), r.riskRebanded(), r.areaReassigned(),
                r.controlRiskRebanded(), r.controlResidualRebanded(), r.duplicatesRemoved(), r.controlsRelinked(),
                r.returnsRetyped());
            return r;
        } catch (Throwable e) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            log.error("[ToolkitRepair] failed: {}", e.getMessage(), e);
            return new Result(0, 0, 0, 0, 0, 0, 0, 0);
        }
    }

    int repairReturnFrequencies() {
        int changed = 0;
        List<RegulatoryReturn> dirty = new ArrayList<>();
        for (RegulatoryReturn r : returns.findAll()) {
            String code = ReturnFrequencyClassifier.classify(r.getFrequency())
                .orElse(ReturnFrequencyClassifier.MONTHLY);
            if (!code.equals(r.getFrequencyType())) {
                r.setFrequencyType(code);
                dirty.add(r);
                changed++;
            }
        }
        returns.saveAll(dirty);
        return changed;
    }

    // ── duplicate obligations ───────────────────────────────────────────────

    /**
     * Keeps one toolkit obligation per act + {@link ObligationKey}. The keeper is the copy that
     * matches a topical (non-{@code crmp}) seed row's interpreted text and section, else the lowest
     * id. Controls point at obligations only through {@code linkedObligationIds}, which
     * {@link #relinkControls} rebuilds afterwards, so nothing else needs re-pointing.
     */
    int removeDuplicateObligations(Collection<Long> toolkitInstrumentIds,
                                   Map<String, List<ToolkitSeedDoc.ObligationRow>> sections) {
        Set<String> topical = topicalSignatures(sections);
        Map<String, List<ObligationMapping>> groups = new HashMap<>();
        for (ObligationMapping o : obligations.findByInstrumentIdIn(toolkitInstrumentIds)) {
            String key = actKey(o.getRegulationId(), o);
            if (key != null) groups.computeIfAbsent(key, k -> new ArrayList<>()).add(o);
        }
        List<ObligationMapping> losers = new ArrayList<>();
        for (List<ObligationMapping> group : groups.values()) {
            if (group.size() < 2) continue;
            ObligationMapping keep = chooseKeeper(group, topical);
            group.stream().filter(o -> o != keep).forEach(losers::add);
        }
        obligations.deleteAll(losers);
        return losers.size();
    }

    static ObligationMapping chooseKeeper(List<ObligationMapping> group, Set<String> topicalSignatures) {
        Comparator<ObligationMapping> byId = Comparator.comparing(ObligationMapping::getObligationId,
            Comparator.nullsLast(Comparator.naturalOrder()));
        return group.stream()
            .filter(o -> topicalSignatures.contains(signature(o.getPlainEnglishStatement(), o.getSpecificSectionReference())))
            .min(byId)
            .orElseGet(() -> group.stream().min(byId).orElseThrow());
    }

    /** Interpreted text + section of every row on a topical sheet (the copy that wins over crmp). */
    static Set<String> topicalSignatures(Map<String, List<ToolkitSeedDoc.ObligationRow>> sections) {
        Set<String> out = new HashSet<>();
        sections.forEach((section, rows) -> {
            if ("crmp".equals(section)) return;
            for (ToolkitSeedDoc.ObligationRow r : rows) {
                String plain = r.getPlain() == null || r.getPlain().isBlank() ? r.getDescription() : r.getPlain();
                out.add(signature(plain, r.getSectionRef()));
            }
        });
        return out;
    }

    static String signature(String plain, String section) {
        return ObligationKey.normalize(plain) + '|' + ObligationKey.normalizeSection(section);
    }

    static String actKey(Long actId, ObligationMapping o) {
        String key = ObligationKey.of(o.getTitle(), o.getSpecificSectionReference(), o.getDescription(),
            o.getPlainEnglishStatement());
        return key == null ? null : actId + "#" + key;
    }

    /** Key of a seed row, cleaned exactly as the importer stores it so it matches the saved obligation. */
    static String actKey(Long actId, ToolkitSeedDoc.ObligationRow r) {
        String plain = r.getPlain() == null || r.getPlain().isBlank() ? r.getDescription() : r.getPlain();
        String key = ObligationKey.of(truncate(r.getTitle(), 500), truncate(r.getSectionRef(), 100),
            clean(r.getDescription()), clean(plain));
        return key == null ? null : actId + "#" + key;
    }

    private static String clean(String s) {
        return s == null ? null : ToolkitImportService.stripQuotes(TextCleaner.stripMarkdown(s.trim()));
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    // ── control → obligation links ──────────────────────────────────────────

    /**
     * Rebuilds {@code linkedObligationIds} of every toolkit control (CRMP area, not tied to a single
     * obligation) from the seed rows that produced it: each row links its own obligation to its
     * Primary/Additional control; a control produced by several rows links all of them.
     * Returns the number of controls whose links changed.
     */
    public int relinkControls(Map<String, List<ToolkitSeedDoc.ObligationRow>> sections) {
        List<ComplianceControl> toolkitControls = controls.findAll().stream()
            .filter(c -> c.getObligationId() == null && c.getComplianceArea() != null
                && ToolkitImportService.CRMP_SECTIONS.contains(c.getComplianceArea()))
            .toList();
        Map<String, Long> actIdByName = new HashMap<>();
        for (ComplianceControl c : toolkitControls) {
            if (c.getActName() != null && c.getActId() != null) actIdByName.putIfAbsent(c.getActName().trim(), c.getActId());
        }
        Map<String, Long> obligationByActKey = new HashMap<>();
        for (ObligationMapping o : obligations.findByRegulationIdIn(new HashSet<>(actIdByName.values()))) {
            String k = actKey(o.getRegulationId(), o);
            if (k != null && o.getObligationId() != null) obligationByActKey.merge(k, o.getObligationId(), Math::min);
        }
        Map<String, Set<Long>> links = linksByControlKey(sections, actIdByName, obligationByActKey);

        List<ComplianceControl> changed = new ArrayList<>();
        for (ComplianceControl c : toolkitControls) {
            Set<Long> ids = links.getOrDefault(controlKey(c.getActName(), c.getControlType(), c.getComplianceControl()), Set.of());
            String joined = ids.isEmpty() ? null
                : ids.stream().sorted().map(String::valueOf).collect(Collectors.joining(","));
            if (!Objects.equals(joined, c.getLinkedObligationIds())) {
                c.setLinkedObligationIds(joined);
                changed.add(c);
            }
        }
        controls.saveAll(changed);
        return changed.size();
    }

    /** Pure: control key → obligation ids of the rows that carry that control. */
    static Map<String, Set<Long>> linksByControlKey(Map<String, List<ToolkitSeedDoc.ObligationRow>> sections,
                                                   Map<String, Long> actIdByName,
                                                   Map<String, Long> obligationByActKey) {
        Map<String, Set<Long>> out = new HashMap<>();
        for (String section : ToolkitImportService.CRMP_SECTIONS) {
            for (ToolkitSeedDoc.ObligationRow r : sections.getOrDefault(section, List.of())) {
                if (r.getSource() == null || r.getSource().isBlank()) continue;
                Long actId = actIdByName.get(r.getSource().trim());
                String k = actId == null ? null : actKey(actId, r);
                Long obligationId = k == null ? null : obligationByActKey.get(k);
                if (obligationId == null) continue;
                if (r.getPrimaryControl() != null && !r.getPrimaryControl().isBlank())
                    out.computeIfAbsent(controlKey(r.getSource(), "PRIMARY", r.getPrimaryControl()), x -> new TreeSet<>()).add(obligationId);
                if (r.getAdditionalControl() != null && !r.getAdditionalControl().isBlank())
                    out.computeIfAbsent(controlKey(r.getSource(), "ADDITIONAL", r.getAdditionalControl()), x -> new TreeSet<>()).add(obligationId);
            }
        }
        return out;
    }

    /** {inherent re-banded, residual re-banded}. */
    int[] repairControls(Map<String, Inherent> inherentByKey) {
        int inherent = 0;
        int residual = 0;
        List<ComplianceControl> changed = new ArrayList<>();
        for (ComplianceControl c : controls.findAll()) {
            boolean dirty = false;
            Inherent in = inherentByKey.get(controlKey(c.getActName(), c.getControlType(), c.getComplianceControl()));
            if (in != null && rebandIfLegacy(c.getRiskLevel(), in.likelihood(), in.impact()) instanceof String band) {
                c.setRiskLevel(band);
                inherent++;
                dirty = true;
            }
            if (rebandIfLegacy(c.getResidualRiskRating(), c.getResidualLikelihood(), c.getResidualImpact()) instanceof String band) {
                c.setResidualRiskRating(band);
                residual++;
                dirty = true;
            }
            if (dirty) changed.add(c);
        }
        controls.saveAll(changed);
        return new int[] { inherent, residual };
    }

    /** The canonical band when {@code current} is still the old toolkit band and differs from it; else null. */
    static String rebandIfLegacy(String current, String likelihood, String impact) {
        String band = RiskBands.band(likelihood, impact);
        String legacy = RiskBands.legacyToolkitBand(likelihood, impact);
        if (band == null || legacy == null || band.equals(legacy)) return null;
        return legacy.equals(current) ? band : null;
    }

    /**
     * Seed row inputs per control, keyed like the importer's natural key but on the act name the
     * importer stores on the control (= the row's source). First row wins, as in the importer.
     */
    static Map<String, Inherent> inherentByControlKey(Map<String, List<ToolkitSeedDoc.ObligationRow>> sections) {
        Map<String, Inherent> out = new HashMap<>();
        for (String section : ToolkitImportService.CRMP_SECTIONS) {
            for (ToolkitSeedDoc.ObligationRow o : sections.getOrDefault(section, List.of())) {
                if (o.getSource() == null || o.getSource().isBlank()) continue;
                Inherent in = new Inherent(
                    ToolkitImportService.normalizeRiskLabel(o.getLikelihoodInherent()),
                    ToolkitImportService.normalizeRiskLabel(o.getImpactInherent()));
                if (o.getPrimaryControl() != null && !o.getPrimaryControl().isBlank())
                    out.putIfAbsent(controlKey(o.getSource(), "PRIMARY", o.getPrimaryControl()), in);
                if (o.getAdditionalControl() != null && !o.getAdditionalControl().isBlank())
                    out.putIfAbsent(controlKey(o.getSource(), "ADDITIONAL", o.getAdditionalControl()), in);
            }
        }
        return out;
    }

    static String controlKey(String actName, String controlType, String text) {
        String type = controlType == null || controlType.isBlank()
            ? "PRIMARY" : controlType.trim().toUpperCase(Locale.ROOT);
        return (actName == null ? "-" : actName.trim()) + '|' + type + '|' + ToolkitControlDedup.normalizeText(text);
    }

    /** The CRMP sections of the committed seed JSON (the source the controls were imported from). */
    Map<String, List<ToolkitSeedDoc.ObligationRow>> seedSections() throws IOException {
        try (InputStream is = new PathMatchingResourcePatternResolver().getResource(SEED_JSON).getInputStream()) {
            ToolkitSeedDoc doc = mapper.readValue(is, ToolkitSeedDoc.class);
            return doc == null || doc.getObligations() == null ? Map.of() : doc.getObligations();
        }
    }
}
