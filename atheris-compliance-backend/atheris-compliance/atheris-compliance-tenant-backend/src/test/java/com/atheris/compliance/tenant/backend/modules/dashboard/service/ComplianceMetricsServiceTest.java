package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import com.atheris.compliance.tenant.backend.modules.dashboard.dto.RiskProfileDto;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** One test per dashboard item that was wrong. */
class ComplianceMetricsServiceTest {

    private final DashboardFixture fx = new DashboardFixture();

    private ComplianceMetricsDto compute() {
        return fx.metrics().compute(null, null);
    }

    // 1 — the score must reflect control performance and missed returns, not coverage alone
    @Test
    void scoreBlendsCoverageEffectivenessReturnsAndFindings() {
        ComplianceMetricsDto m = compute();
        // 30*80 (coverage) + 25*25 (1 of 4 controls passing) + 30*33.3 (1 of 3 due filed on time) + 15*100
        assertEquals(55.25, m.getComplianceScore(), 0.06);
        assertNotEquals(100.0, m.getComplianceScore());
        assertEquals(4, m.getScoreBreakdown().size());
        assertTrue(m.getScoreBreakdown().stream().allMatch(ComplianceMetricsDto.ScoreComponent::isIncluded));
        assertEquals("Control effectiveness", m.getScoreBreakdown().get(1).getLabel());
    }

    @Test
    void componentWithoutDataIsLeftOutNotScoredAsPerfect() {
        fx.returnRows.clear();            // nothing due → returns on time is N/A
        fx.findingRows.clear();           // no findings → N/A
        ComplianceMetricsDto m = compute();
        assertNull(m.getReturnsOnTimePct());
        assertNull(m.getScoreComponents().get("returnsOnTime"));
        // (30*80 + 25*25) / 55
        assertEquals(55.0, m.getComplianceScore(), 0.06);
    }

    // 2 — coverage is tested ÷ total, from test results; tests due come from open test tasks
    @Test
    void testCoverageAndTestsDueComeFromTestsAndTasks() {
        ComplianceMetricsDto m = compute();
        assertEquals(2, m.getControlsTested());
        assertEquals(2, m.getControlsUntested());
        assertEquals(50.0, m.getControlTestCompletion());
        assertEquals(2, m.getControlTestsDue(), "overdue + due within 30 days");
        assertEquals(1, m.getControlTestsOverdue());
    }

    @Test
    void testCoverageIsNullWithNoControls() {
        fx.controlRows.clear();
        assertNull(compute().getControlTestCompletion());
    }

    // 3 — failing means "latest test failed", not "residual risk High"
    @Test
    void passAndFailComeFromTheLatestTestResult() {
        ComplianceMetricsDto m = compute();
        assertEquals(1, m.getControlsPassing());
        assertEquals(1, m.getControlsFailing(), "control 4 passed once, then failed");
        assertEquals(50.0, m.getControlEffectivenessPct());
        assertEquals(3, m.getControlsHighResidualRisk(), "residual High/Critical is reported separately");
    }

    // 4 — returns on time uses filings due as the denominator; overdue counts as a miss
    @Test
    void returnsOnTimeDenominatorIsFilingsDue() {
        ComplianceMetricsDto m = compute();
        assertEquals(3, m.getReturnsDue());
        assertEquals(1, m.getReturnsSubmittedOnTime());
        assertEquals(33.3, m.getReturnsOnTimePct());
    }

    @Test
    void returnsOnTimeIsNaWhenNothingFiledOrOverdue() {
        fx.returnRows.removeIf(i -> i.getDueDate().isBefore(DashboardFixture.TODAY)
            || i.getStatus() == ReturnFilingStatus.SUBMITTED);
        assertNull(compute().getReturnsOnTimePct());
    }

    // 6/7 — every obligation in exactly one area and one act bucket
    @Test
    void areaAndActBucketsCoverEveryApplicableObligation() {
        ComplianceMetricsDto m = compute();
        assertEquals(2, m.getObligationsByArea().get("Unassigned"), "no area + generic CRMP sheet");
        assertFalse(m.getObligationsByArea().containsKey("Compliance Risk Management"));
        assertEquals(1, m.getObligationsByAct().get("Unassigned"));
    }

    // 8 — a missing rating is "Unrated", never a real band
    @Test
    void missingRiskIsUnratedInTheRiskProfile() {
        RiskProfileDto p = fx.v2().getRiskProfile();
        assertEquals(1, p.getSummary().getUnratedCount());
        assertEquals(1, p.getSummary().getLowCount(), "only the obligation actually rated Low");
        assertEquals(2, p.getSummary().getActCount(), "Unassigned is not an act");
        List<String> levels = p.getRiskLevels().stream().map(RiskProfileDto.RiskRow::getLevel).toList();
        assertTrue(levels.contains("Unrated"));
    }
}
