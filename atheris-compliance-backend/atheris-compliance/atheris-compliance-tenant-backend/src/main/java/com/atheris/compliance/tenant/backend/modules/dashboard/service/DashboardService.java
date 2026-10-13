package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import com.atheris.compliance.tenant.backend.modules.dashboard.entity.DashboardSnapshot;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.DashboardSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Snapshot orchestration. All metric values come from {@link ComplianceMetricsService}
 * (the single source of truth) so the nightly snapshot, the dashboards and the board pack
 * never disagree.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class DashboardService {

    private final DashboardSnapshotRepository snapshots;
    private final ComplianceMetricsService metrics;

    public DashboardSnapshot getLatest() {
        return snapshots.findTopByOrderBySnapshotDateDescSnapshotIdDesc()
            .orElseGet(this::computeSnapshot);
    }

    public List<DashboardSnapshot> getTrend() {
        return snapshots.findTop12ByOrderBySnapshotDateDesc();
    }

    /**
     * Live attention items for the dashboard. Derived from the same metrics service, so the
     * counts match the board pack and the drill-downs.
     */
    public Map<String, Object> getAttentionItems() {
        ComplianceMetricsDto m = metrics.compute(LocalDate.now().minusYears(1), LocalDate.now());
        return Map.of(
            "high_risk_findings", m.getFindingsHighSeverity(),
            "overdue_returns", m.getReturnsOverdue(),
            "obligations_no_control", m.getObligationsWithGaps(),
            "controls_failing", m.getControlsHighResidualRisk()
        );
    }

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public DashboardSnapshot computeAndStore() {
        try {
            DashboardSnapshot s = computeSnapshot();
            log.info("Dashboard snapshot computed. Score: {}", s.getComplianceScore());
            return s;
        } catch (Throwable e) {
            log.error("Dashboard snapshot computation failed: {}", e.getMessage(), e);
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
            throw e instanceof RuntimeException ? (RuntimeException) e : new RuntimeException(e);
        }
    }

    /**
     * Same computation as the 2am cron, in its own transaction. For callers running in a
     * {@code TransactionSynchronization.afterCommit()} hook (e.g. bulk import): there the committed
     * transaction is still bound, so a plain {@code REQUIRED} call would join it and its insert would
     * never be committed.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public DashboardSnapshot recomputeInNewTransaction() {
        return computeSnapshot();
    }

    @Transactional
    public DashboardSnapshot computeSnapshot() {
        ComplianceMetricsDto m = metrics.compute(LocalDate.now().minusYears(1), LocalDate.now());

        DashboardSnapshot s = DashboardSnapshot.builder()
            .snapshotDate(LocalDate.now()).computedAt(Instant.now())
            .totalObligationsActive(m.getObligationsApplicable())
            .totalObligationsInapplicable(m.getObligationsNotApplicable())
            .obligationsHighRisk(m.getObligationsHighRisk())
            .obligationsWithGaps(m.getObligationsWithGaps())
            .controlsTotal(m.getControlsTotal())
            .controlsPassing(m.getControlsPassing())
            .controlsFailing(m.getControlsHighResidualRisk())
            .controlsTestCompletionRate(m.getControlTestCompletion())
            .findingsOpen(m.getFindingsOpen())
            .findingsHighSeverity(m.getFindingsHighSeverity())
            .findingsOverdueRemediation(m.getFindingsOverdueRemediation())
            .returnsTotal(m.getReturnsTotal())
            .returnsSubmittedOnTime(m.getReturnsSubmittedOnTime())
            .returnsSubmittedLate(m.getReturnsSubmittedLate())
            .returnsPending(m.getReturnsPending())
            .totalPenaltyExposureNaira(m.getPenaltyExposureNaira())
            .complianceScore(m.getComplianceScore())
            .build();
        return snapshots.save(s);
    }
}