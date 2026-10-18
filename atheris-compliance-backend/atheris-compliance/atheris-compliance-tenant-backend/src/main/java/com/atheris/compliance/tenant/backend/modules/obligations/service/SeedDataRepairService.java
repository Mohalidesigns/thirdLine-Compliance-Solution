package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.common.taxonomy.AreasOfFocus;
import com.atheris.compliance.tenant.backend.modules.controls.service.SeedControlRepairService;
import com.atheris.compliance.tenant.backend.modules.dashboard.service.DashboardService;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Aligns obligations seeded under older rules with the current seed (idempotent; runs until it
 * succeeds once per start, because the platform may come up after this backend):
 * <ul>
 *   <li><b>act</b> — the seed never set {@code actName}/{@code regulationId}, so every obligation
 *       showed as "Unassigned" in Risk by Act;</li>
 *   <li><b>area</b> — inherited from the instrument (universe vocabulary); the generic CRMP sheet
 *       name is no longer an area;</li>
 *   <li><b>risk</b> — re-banded from likelihood × impact. Only ratings still equal to what the old
 *       toolkit band produced are changed, so a rating a user set is kept.</li>
 * </ul>
 * Seeded obligations only. Seeded controls are re-banded in the same run by
 * {@link SeedControlRepairService}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SeedDataRepairService {

    static final String SEEDED = "seeded";

    private final PlatformApiClient platform;
    private final TenantRegulatorRepository tenantRegulators;
    private final ObligationRepository obligationRepo;
    private final ObligationClassificationRepository classifications;
    private final TenantIdentityService tenantIdentity;
    private final PlatformTransactionManager txManager;
    private final ObligationService obligationService;
    private final DashboardService dashboardService;
    private final SeedControlRepairService controlRepair;

    private final AtomicBoolean done = new AtomicBoolean(false);
    private TransactionTemplate tx;

    /** What the platform says about an instrument's act and area. */
    public record InstrumentContext(Long regulationId, String regulationName, String areaOfFocus) {}

    public record Result(int actLinked, int areaReassigned, int riskRebanded, int classificationsUpdated) {}

    @PostConstruct
    void init() {
        tx = new TransactionTemplate(txManager);
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 300_000)
    public void repairOnce() {
        if (done.get()) return;
        try {
            Long tenantId = tenantIdentity.currentTenantId();
            List<Integer> platformIds = tenantRegulators.findByTenantIdAndIsActiveTrue(tenantId).stream()
                .map(TenantRegulator::getPlatformRegulatorId).filter(Objects::nonNull).distinct().toList();
            List<Obligation> seeded = obligationRepo.findBySource(SEEDED);
            if (seeded.isEmpty() || platformIds.isEmpty()) {
                done.set(true);
                return;
            }
            List<PlatformRegulationSeed> bundles = platform.fetchRegulationSeeds(platformIds);
            if (bundles.isEmpty()) return; // platform not reachable yet — retry on the next run
            Map<Long, InstrumentContext> context = contextByInstrument(bundles);
            Result r = tx.execute(status -> repair(context));
            SeedControlRepairService.Result cr = tx.execute(status -> controlRepair.repair(bundles));
            obligationService.evictRegisterCache();
            if (r.actLinked() + r.areaReassigned() + r.riskRebanded() + r.classificationsUpdated()
                    + cr.riskRebanded() + cr.residualRatingRebanded() + cr.howTestedCleared() > 0)
                dashboardService.refreshTodaySnapshot();   // today's trend point reflects the repaired data
            log.info("[SeedRepair] act linked={}, area reassigned={}, risk re-banded={}, classifications updated={}",
                r.actLinked(), r.areaReassigned(), r.riskRebanded(), r.classificationsUpdated());
            log.info("[SeedRepair] controls risk re-banded={}, cadence changed={}, tests rescheduled={}, residual rating re-banded={}, howTested cleared={}",
                cr.riskRebanded(), cr.cadenceChanged(), cr.tasksRescheduled(), cr.residualRatingRebanded(), cr.howTestedCleared());
            done.set(true);
        } catch (Throwable e) {
            log.warn("[SeedRepair] skipped this run: {}", e.getMessage());
        }
    }

    static Map<Long, InstrumentContext> contextByInstrument(List<PlatformRegulationSeed> bundles) {
        Map<Long, InstrumentContext> out = new HashMap<>();
        for (PlatformRegulationSeed b : bundles) {
            if (b.getCanonicalInstrument() == null || b.getCanonicalInstrument().getInstrumentId() == null) continue;
            out.putIfAbsent(b.getCanonicalInstrument().getInstrumentId(), new InstrumentContext(
                b.getRegulationId(), b.getRegulationName(), b.getCanonicalInstrument().getAreaOfFocus()));
        }
        return out;
    }

    Result repair(Map<Long, InstrumentContext> context) {
        List<Obligation> seeded = obligationRepo.findBySource(SEEDED);
        Map<Long, ObligationClassification> byObligation = classifications
            .findByObligationIdIn(seeded.stream().map(Obligation::getObligationId).toList()).stream()
            .collect(Collectors.toMap(ObligationClassification::getObligationId, Function.identity(), (a, b) -> a));
        Result r = apply(seeded, byObligation, context);
        obligationRepo.saveAll(seeded);
        classifications.saveAll(byObligation.values());
        return r;
    }

    /** Pure: mutates the given rows in place and reports what changed. */
    static Result apply(List<Obligation> seeded, Map<Long, ObligationClassification> byObligation,
                        Map<Long, InstrumentContext> context) {
        int act = 0, area = 0, risk = 0, cls = 0;
        for (Obligation o : seeded) {
            InstrumentContext ctx = context.get(o.getInstrumentId());
            if (ctx != null && (o.getActName() == null || o.getActName().isBlank()) && ctx.regulationName() != null) {
                o.setActName(ctx.regulationName());
                o.setRegulationId(ctx.regulationId());
                act++;
            }
            if (ctx != null) {
                String newArea = AreasOfFocus.forObligation(ctx.areaOfFocus(), o.getAreaOfFocus());
                if (!Objects.equals(newArea, o.getAreaOfFocus())) {
                    o.setAreaOfFocus(newArea);
                    area++;
                }
            }

            String legacy = RiskBands.legacyToolkitBand(o.getInherentLikelihood(), o.getInherentImpact());
            String band = RiskBands.band(o.getInherentLikelihood(), o.getInherentImpact());
            if (band != null && legacy != null && !band.equals(legacy) && legacy.equals(o.getInherentRiskRating())) {
                o.setInherentRiskRating(band);
                risk++;
            }

            ObligationClassification c = byObligation.get(o.getObligationId());
            if (c == null) continue;
            boolean changed = false;
            String cLegacy = RiskBands.legacyToolkitBand(c.getLikelihoodRating(), c.getImpactRating());
            String cBand = RiskBands.band(c.getLikelihoodRating(), c.getImpactRating());
            if (cBand != null && cLegacy != null && !cBand.equals(cLegacy) && cLegacy.equals(c.getTenantRiskRating())) {
                c.setTenantRiskRating(cBand);
                changed = true;
            }
            String before = c.getInherentRiskRating();
            c.computeInherentRisk();
            if (!Objects.equals(before, c.getInherentRiskRating())) changed = true;
            if (changed) cls++;
        }
        return new Result(act, area, risk, cls);
    }
}
