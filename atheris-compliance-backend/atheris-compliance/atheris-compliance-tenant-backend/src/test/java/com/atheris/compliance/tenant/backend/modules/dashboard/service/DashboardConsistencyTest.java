package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import com.atheris.compliance.tenant.backend.modules.dashboard.dto.RiskProfileDto;
import com.atheris.compliance.tenant.backend.modules.subscriptions.dto.UniverseStatsResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.service.InstrumentsService;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PagedResponse;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentSummary;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * The dashboard's widgets must agree with each other: every breakdown adds up to its total, and
 * the same quantity shown in two places is the same number.
 */
class DashboardConsistencyTest {

    private final DashboardFixture fx = new DashboardFixture();
    private final ComplianceMetricsDto m = fx.metrics().compute(null, null);
    private final RiskProfileDto profile = fx.v2().getRiskProfile();

    private static int sum(Map<String, Integer> map) {
        return map.values().stream().mapToInt(Integer::intValue).sum();
    }

    @Test
    void obligationBreakdownsAddUpToApplicable() {
        int applicable = m.getObligationsApplicable();
        assertEquals(applicable, sum(m.getObligationsByRisk()), "risk");
        assertEquals(applicable, sum(m.getObligationsByArea()), "area of focus");
        assertEquals(applicable, sum(m.getObligationsByAct()), "act");
    }

    @Test
    void riskProfileAgreesWithTheMetrics() {
        RiskProfileDto.Summary s = profile.getSummary();
        assertEquals(m.getObligationsApplicable(), s.getTotalApplicable());
        assertEquals(s.getTotalApplicable(), profile.getRiskLevels().stream().mapToInt(RiskProfileDto.RiskRow::getCount).sum());
        assertEquals(s.getTotalApplicable(),
            s.getExtremeCount() + s.getHighCount() + s.getMediumCount() + s.getLowCount() + s.getUnratedCount());
        // the "Critical/High obligations" KPI is the risk profile's Critical + High
        assertEquals(m.getObligationsHighRisk(), s.getExtremeCount() + s.getHighCount());
        assertEquals(m.getObligationsWithGaps(), s.getGapsCount());
    }

    @Test
    void areaAndActTablesAddUpAndEachRowAddsUp() {
        int total = profile.getSummary().getTotalApplicable();
        assertEquals(total, profile.getByAreaOfFocus().stream().mapToInt(RiskProfileDto.AreaRow::getTotal).sum());
        assertEquals(total, profile.getByAct().stream().mapToInt(RiskProfileDto.ActRow::getTotal).sum());
        for (RiskProfileDto.AreaRow r : profile.getByAreaOfFocus()) {
            assertEquals(r.getTotal(), r.getExtreme() + r.getHigh() + r.getMedium() + r.getLow() + r.getUnrated(), r.getAreaOfFocus());
        }
        // both panels use one vocabulary: the dashboard area table and the metrics agree name by name
        for (RiskProfileDto.AreaRow r : profile.getByAreaOfFocus()) {
            assertEquals(r.getTotal(), m.getObligationsByArea().get(r.getAreaOfFocus()), r.getAreaOfFocus());
        }
        assertEquals(profile.getByAct().stream().filter(a -> !"Unassigned".equals(a.getActName())).count(),
            profile.getSummary().getActCount());
    }

    @Test
    void controlStatesAddUpToTotal() {
        assertEquals(m.getControlsTotal(), m.getControlsTested() + m.getControlsUntested());
        assertTrue(m.getControlsPassing() + m.getControlsFailing() <= m.getControlsTested());
        assertEquals(m.getControlTestCompletion(), 100.0 * m.getControlsTested() / m.getControlsTotal(), 0.05);
    }

    @Test
    void returnsOnTimeIsConsistentWithItsCounts() {
        assertEquals(m.getReturnsDue(), m.getReturnsSubmittedOnTime() + m.getReturnsSubmittedLate()
            + (int) fx.returnRows.stream().filter(i -> i.getDueDate().isBefore(DashboardFixture.TODAY)
                && i.getStatus() != com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus.SUBMITTED
                && i.getStatus() != com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus.SUBMITTED_LATE).count());
        assertEquals(m.getReturnsOnTimePct(), 100.0 * m.getReturnsSubmittedOnTime() / m.getReturnsDue(), 0.05);
    }

    @Test
    void scoreIsTheWeightedMeanOfItsIncludedComponents() {
        double weighted = 0;
        int weights = 0;
        for (ComplianceMetricsDto.ScoreComponent c : m.getScoreBreakdown()) {
            if (!c.isIncluded()) continue;
            weighted += c.getValue() * c.getWeight();
            weights += c.getWeight();
        }
        assertEquals(weighted / weights, m.getComplianceScore(), 0.1);
    }

    @Test
    void universeRiskAndAreaBreakdownsAddUpToTotal() {
        PlatformApiClient platform = mock(PlatformApiClient.class);
        TenantRegulatorRepository regs = mock(TenantRegulatorRepository.class);
        TenantIdentityService identity = mock(TenantIdentityService.class);
        when(identity.currentTenantId()).thenReturn(1L);
        when(regs.findByTenantIdAndIsActiveTrue(1L)).thenReturn(List.of(TenantRegulator.builder().platformRegulatorId(7).build()));
        when(fx.obligations.findDistinctInstrumentIds()).thenReturn(List.of(1L, 2L, 3L, 4L));
        List<PlatformInstrumentSummary> rows = List.of(
            PlatformInstrumentSummary.builder().instrumentId(1L).riskRating("High").areaOfFocus("AML/CFT/CPF").nature("Act").build(),
            PlatformInstrumentSummary.builder().instrumentId(2L).nature("Others").build(),   // unrated, no area
            PlatformInstrumentSummary.builder().instrumentId(3L).riskRating("Medium").areaOfFocus("Financial reporting").nature("Act").build(),
            PlatformInstrumentSummary.builder().instrumentId(4L).areaOfFocus("Financial Reporting").nature("Others").build());
        when(platform.searchInstruments(any(), any(), any()))
            .thenReturn(PagedResponse.<PlatformInstrumentSummary>builder().content(rows).totalPages(1).build());

        UniverseStatsResponse u = new InstrumentsService(platform, regs, fx.obligations, identity).universeStats();

        long total = u.getTotal();
        assertEquals(total, u.getByRiskRating().values().stream().mapToLong(Long::longValue).sum(), "risk incl. Unrated");
        assertEquals(total, u.getByAreaOfFocus().values().stream().mapToLong(Long::longValue).sum(), "area incl. Unassigned");
        assertEquals(total, u.getByNature().values().stream().mapToLong(Long::longValue).sum(), "nature");
        assertEquals(2L, u.getByRiskRating().get("Unrated"));
        assertEquals(1L, u.getByAreaOfFocus().get("Unassigned"));
        assertEquals(2L, u.getByAreaOfFocus().get("Financial Reporting"), "spelling variants folded");
    }
}
