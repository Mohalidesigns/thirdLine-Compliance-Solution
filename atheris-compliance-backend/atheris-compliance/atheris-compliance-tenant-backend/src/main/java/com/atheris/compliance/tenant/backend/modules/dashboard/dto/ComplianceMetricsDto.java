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

    // ── Controls ── (pass/fail come from control test results, never from a risk rating)
    @Builder.Default private int controlsTotal = 0;
    @Builder.Default private int controlsHighResidualRisk = 0;  // residual rating High or Critical (untested = inherent)
    @Builder.Default private int controlsTested = 0;            // controls with at least one test result
    @Builder.Default private int controlsUntested = 0;
    @Builder.Default private int controlsPassing = 0;           // latest test Passed
    @Builder.Default private int controlsFailing = 0;           // latest test Failed or Partial
    @Builder.Default private int controlTestsDue = 0;           // open test tasks due within 30 days (incl. overdue)
    @Builder.Default private int controlTestsOverdue = 0;       // open test tasks past their due date
    @Builder.Default private double controlCoverage = 0.0;      // % of applicable obligations with a linked control
    /** % of controls with a test result (tested ÷ total); null when there are no controls. */
    private Double controlTestCompletion;
    /** % of tested controls whose latest test passed (passing ÷ tested); null when none tested. */
    private Double controlEffectivenessPct;

    // ── Returns ──
    @Builder.Default private int returnsTotal = 0;              // filing periods due in the period
    @Builder.Default private int returnsDue = 0;                // filed + overdue: the on-time denominator
    @Builder.Default private int returnsSubmittedOnTime = 0;
    @Builder.Default private int returnsSubmittedLate = 0;
    @Builder.Default private int returnsPending = 0;
    @Builder.Default private int returnsOverdue = 0;
    /** % of due filings submitted on time ((on time) ÷ (filed + overdue)); null when nothing was due yet. */
    private Double returnsOnTimePct;

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
    /** Component values (0..100); null = no data, left out of the score. */
    @Builder.Default private Map<String, Double> scoreComponents = Map.of();
    /** Components with label, weight and whether they counted — drives the score tooltip. */
    @Builder.Default private List<ScoreComponent> scoreBreakdown = List.of();

    // ── Attention ──
    @Builder.Default private List<AttentionItem> attentionItems = List.of();

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class FindingAge {
        private String severity;
        private long count;
        private double averageAgeDays;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ScoreComponent {
        private String key;
        private String label;
        private String definition;
        private int weight;
        private Double value;      // null = no data
        private boolean included;  // counted in the score
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AttentionItem {
        private String category;   // returns | controls | obligations | findings
        private String label;
        private long count;
        private String severity;   // high | medium | low
    }
}