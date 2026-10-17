package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.common.taxonomy.AreasOfFocus;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

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
 *   <li>instrument area spelling variants folded onto one name.</li>
 * </ul>
 * Toolkit seed rows only — AI-extracted obligations keep the classifier's values.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ToolkitDataRepairService {

    static final String TOOLKIT_SEED = "toolkit_seed";

    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;

    public record Result(int instrumentsUpdated, int riskRebanded, int areaReassigned) {}

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

            Result r = new Result(changedInstruments.size(), rebanded, reassigned);
            log.info("[ToolkitRepair] instruments area-normalised={}, obligations risk re-banded={}, area reassigned={}",
                r.instrumentsUpdated(), r.riskRebanded(), r.areaReassigned());
            return r;
        } catch (Throwable e) {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            log.error("[ToolkitRepair] failed: {}", e.getMessage(), e);
            return new Result(0, 0, 0);
        }
    }
}
