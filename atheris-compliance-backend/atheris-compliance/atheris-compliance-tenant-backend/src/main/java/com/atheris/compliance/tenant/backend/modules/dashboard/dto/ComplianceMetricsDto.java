package com.atheris.compliance.tenant.backend.modules.dashboard.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Canonical, period-aware compliance metrics. Single source of truth for the dashboards,
 * the nightly snapshot and the board pack, so a board document never disagrees with the UI.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComplianceMetricsDto {

    private LocalDate periodFrom;
    private LocalDate periodTo;

    // ── Obligations ──
    @Builder.Default private int obligationsTotal = 0;
    @Builder.Default private int obligationsApplicable = 0;
    @Builder.Default private int obligationsNotApplicable = 0;
    @Builder.Default private int obligationsUnderReview = 0;
    @Builder.Default private int obligationsHighRisk = 0;
    @Builder.Default private int obligationsWithGaps = 0;
    @Builder.Default private Map<String, Integer> obligationsByRisk = Map.of();
    @Builder.Default private Map<String, Integer> obligationsByArea = Map.of();
    @Builder.Default private Map<String, Integer> obligationsByAct = Map.of();

    // ── Controls ──
    @Builder.Default private int controlsTotal = 0;
    @Builder.Default private int controlsHighResidualRisk = 0;
    @Builder.Default private int controlsPassing = 0;
    @Builder.Default private double controlCoverage = 0.0;      // % of applicable obligations with a linked control
    @Builder.Default private double controlTestCompletion = 0.0; // % of control tasks due in period that were completed

    // ── Returns ──
    @Builder.Default private int returnsTotal = 0;
    @Builder.Default private int returnsSubmittedOnTime = 0;
    @Builder.Default private int returnsSubmittedLate = 0;
    @Builder.Default private int returnsPending = 0;
    @Builder.Default private int returnsOverdue = 0;
    @Builder.Default private double returnsOnTimePct = 0.0;

    // ── Findings ──
    @Builder.Default private int findingsOpen = 0;              // Open + In Remediation
    @Builder.Default private int findingsHighSeverity = 0;      // Critical + High
    @Builder.Default private int findingsOverdueRemediation = 0;
    @Builder.Default private double findingsWithinSlaPct = 0.0;
    @Builder.Default private List<FindingAge> findingsAgeing = List.of();

    // ── Sanctions ──
    @Builder.Default private BigDecimal penaltyExposureNaira = BigDecimal.ZERO;
    @Builder.Default private Map<String, BigDecimal> exposureByAct = Map.of();

    // ── Score ──
    private Double complianceScore;
    @Builder.Default private Map<String, Double> scoreComponents = Map.of();

    // ── Attention ──
    @Builder.Default private List<AttentionItem> attentionItems = List.of();

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class FindingAge {
        private String severity;
        private long count;
        private double averageAgeDays;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AttentionItem {
        private String category;   // returns | controls | obligations | findings
        private String label;
        private long count;
        private String severity;   // high | medium | low
    }
}