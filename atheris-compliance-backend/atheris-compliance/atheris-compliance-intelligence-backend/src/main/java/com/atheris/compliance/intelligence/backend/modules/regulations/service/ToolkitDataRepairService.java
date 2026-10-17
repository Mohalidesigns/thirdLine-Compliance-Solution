package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.common.taxonomy.AreasOfFocus;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.seed.ToolkitSeedDoc;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.ComplianceControlRepository;
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
 *       only while it still equals the old band, so an admin's rating is kept.</li>
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
    private final ObjectMapper mapper;

    public record Result(int instrumentsUpdated, int riskRebanded, int areaReassigned,
                         int controlRiskRebanded, int controlResidualRebanded) {}

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

            int[] controlCounts = repairControls(inherentByControlKey(seedSections()));

            Result r = new Result(changedInstruments.size(), rebanded, reassigned, controlCounts[0], controlCounts[1]);
            log.info("[ToolkitRepair] instruments area-normalised={}, obligations risk re-banded={}, area reassigned={}, "
                    + "controls risk re-banded={}, controls residual re-banded={}",
                r.instrumentsUpdated(), r.riskRebanded(), r.areaReassigned(),
                r.controlRiskRebanded(), r.controlResidualRebanded());
            return r;
        } catch (Throwable e) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            log.error("[ToolkitRepair] failed: {}", e.getMessage(), e);
            return new Result(0, 0, 0, 0, 0);
        }
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
