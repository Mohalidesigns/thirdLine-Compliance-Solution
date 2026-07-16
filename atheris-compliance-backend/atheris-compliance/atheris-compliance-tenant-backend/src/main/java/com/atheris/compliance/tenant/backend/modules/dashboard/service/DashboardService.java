package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.controls.repository.*;
import com.atheris.compliance.tenant.backend.modules.dashboard.entity.DashboardSnapshot;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.DashboardSnapshotRepository;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class DashboardService {

    private final DashboardSnapshotRepository snapshots;
    private final ObligationClassificationRepository obligations;
    private final ControlRepository controls;
    private final FindingRepository findings;
    private final ReturnFilingInstanceRepository returnsRepo;

    public DashboardSnapshot getLatest() {
        return snapshots.findTopByOrderBySnapshotDateDesc()
            .orElseGet(this::computeSnapshot);
    }

    public List<DashboardSnapshot> getTrend() {
        return snapshots.findTop12ByOrderBySnapshotDateDesc();
    }

    public Map<String, Object> getAttentionItems() {
        return Map.of(
            "high_risk_findings", findings.findByStatusAndSeverity("Open", "Critical").size(),
            "overdue_returns", returnsRepo.findByStatusNotInAndDueDateBefore(List.of("Submitted", "Submitted Late"), LocalDate.now()).size(),
            "obligations_no_control", obligations.findByHasGapTrue().size(),
            "controls_failing", controls.findByResidualRisk("High").size()
        );
    }

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public DashboardSnapshot computeAndStore() {
        DashboardSnapshot s = computeSnapshot();
        log.info("Dashboard snapshot computed. Score: {}", s.getComplianceScore());
        return s;
    }

    @Transactional
    public DashboardSnapshot computeSnapshot() {
        long totalActive = obligations.countByApplicability("applicable");
        long totalInapplicable = obligations.countByApplicability("not_applicable");
        long gaps = obligations.countByHasGapTrue();
        long totalControls = controls.count();
        long failing = controls.findByResidualRisk("High").size();
        long passing = totalControls - failing;
        double testRate = totalControls > 0 ? (double) passing / totalControls * 100 : 0;
        long openFindings = findings.countByStatus("Open");
        long highFindings = findings.countBySeverity("High");
        long overdueFix = findings.findByStatusInAndRemediationDeadlineBefore(List.of("Open", "In Remediation"), LocalDate.now()).size();
        long totalReturns = returnsRepo.count();
        long onTime = returnsRepo.countByStatus("Submitted");
        long late = returnsRepo.countByStatus("Submitted Late");
        long pending = returnsRepo.countByStatus("Not Started") + returnsRepo.countByStatus("In Progress");

        double score = Math.min(100.0,
            (totalControls > 0 ? (passing / (double) totalControls) * 40 : 0) +
            (totalReturns > 0 ? (onTime / (double) totalReturns) * 30 : 30) + 20.0 +
            (totalActive + totalInapplicable > 0 ? 10.0 : 0));

        DashboardSnapshot s = DashboardSnapshot.builder()
            .snapshotDate(LocalDate.now()).computedAt(Instant.now())
            .totalObligationsActive((int) totalActive)
            .totalObligationsInapplicable((int) totalInapplicable)
            .obligationsHighRisk((int) totalActive)
            .obligationsWithGaps((int) gaps)
            .controlsTotal((int) totalControls)
            .controlsPassing((int) passing)
            .controlsFailing((int) failing)
            .controlsTestCompletionRate(testRate)
            .findingsOpen((int) openFindings)
            .findingsHighSeverity((int) highFindings)
            .findingsOverdueRemediation((int) overdueFix)
            .returnsTotal((int) totalReturns)
            .returnsSubmittedOnTime((int) onTime)
            .returnsSubmittedLate((int) late)
            .returnsPending((int) pending)
            .totalPenaltyExposureNaira(BigDecimal.ZERO)
            .complianceScore(score).build();
        return snapshots.save(s);
    }
}
