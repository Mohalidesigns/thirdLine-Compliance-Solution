package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import com.atheris.compliance.tenant.backend.modules.dashboard.entity.DashboardSnapshot;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.DashboardSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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

    static final int TREND_DAYS = 30;

    /** One snapshot per day (the newest), newest first, at most {@link #TREND_DAYS} days. */
    public List<DashboardSnapshot> getTrend() {
        Map<LocalDate, DashboardSnapshot> perDay = new LinkedHashMap<>();
        for (DashboardSnapshot s : snapshots.findTop60ByOrderBySnapshotDateDescSnapshotIdDesc()) {
            perDay.putIfAbsent(s.getSnapshotDate(), s);
        }
        List<DashboardSnapshot> out = new ArrayList<>(perDay.values());
        return out.size() > TREND_DAYS ? out.subList(0, TREND_DAYS) : out;
    }

    /**
     * The 2am cron only fires while the backend is running, which left days without a snapshot.
     * Today's snapshot is therefore also refreshed on startup and hourly (one row per day, so the
     * trend's last point tracks the live metrics). Past days cannot be backfilled: the metrics are
     * point-in-time (no history of control/return/finding state), so a missing day stays a gap
     * rather than an invented value.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void refreshTodayOnStartup() {
        refreshTodaySnapshot();
    }

    @Scheduled(cron = "0 15 * * * *")
    public void refreshTodaySnapshot() {
        try {
            DashboardSnapshot s = computeSnapshot();
            log.info("Dashboard snapshot for {} refreshed. Score: {}", s.getSnapshotDate(), s.getComplianceScore());
        } catch (Throwable e) {
            log.warn("Dashboard snapshot refresh skipped: {}", e.getMessage());
        }
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
            // latest control test Failed/Partial — not a residual-risk rating
            "controls_failing", m.getControlsFailing()
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

        // one row per day: a later run the same day replaces it
        DashboardSnapshot s = snapshots.findFirstBySnapshotDateOrderBySnapshotIdDesc(LocalDate.now())
            .orElseGet(DashboardSnapshot::new);
        DashboardSnapshot fresh = DashboardSnapshot.builder()
            .snapshotId(s.getSnapshotId())
            .snapshotDate(LocalDate.now()).computedAt(Instant.now())
            .totalObligationsActive(m.getObligationsApplicable())
            .totalObligationsInapplicable(m.getObligationsNotApplicable())
            .obligationsHighRisk(m.getObligationsHighRisk())
            .obligationsWithGaps(m.getObligationsWithGaps())
            .controlsTotal(m.getControlsTotal())
            .controlsPassing(m.getControlsPassing())
            .controlsFailing(m.getControlsFailing())
            .controlsTestCompletionRate(m.getControlTestCompletion())
            .findingsOpen(m.getFindingsOpen())
            .findingsHighSeverity(m.getFindingsHighSeverity())
            .findingsOverdueRemediation(m.getFindingsOverdueRemediation())
            // returns_total = filings due (filed + overdue): the denominator of "returns on time"
            .returnsTotal(m.getReturnsDue())
            .returnsSubmittedOnTime(m.getReturnsSubmittedOnTime())
            .returnsSubmittedLate(m.getReturnsSubmittedLate())
            .returnsPending(m.getReturnsPending())
            .totalPenaltyExposureNaira(m.getPenaltyExposureNaira())
            .complianceScore(m.getComplianceScore())
            .build();
        return snapshots.save(fresh);
    }
}