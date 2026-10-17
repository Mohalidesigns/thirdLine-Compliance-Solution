package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTask;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTaskRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ComplianceMetricsDto;
import com.atheris.compliance.tenant.backend.modules.dashboard.entity.ComplianceScoreWeights;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.ComplianceScoreWeightsRepository;
import com.atheris.compliance.tenant.backend.modules.findings.entity.Finding;
import com.atheris.compliance.tenant.backend.modules.findings.repository.FindingRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus;
import com.atheris.compliance.common.taxonomy.AreasOfFocus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Single source of truth for the compliance metrics used by the dashboards, the nightly
 * snapshot and the board pack. All figures are period-aware ({@code from}..{@code to}).
 *
 * Fixes carried in from the old {@code DashboardService.computeSnapshot}:
 *  - high-risk uses the canonical bands (Critical + High), not the outdated "Extreme";
 *  - a control gap has ONE definition: an applicable obligation with no linked control;
 *  - findings "open" = Open + In Remediation, "high severity" = Critical + High;
 *  - controls pass/fail on their latest TEST RESULT, never on a risk rating (seeded residual risk is
 *    a copy of inherent risk, so "residual High" was being shown as "failing");
 *  - returns on time = on time ÷ (filed + overdue): a period not yet due is not a miss, an overdue one is;
 *  - a metric with an empty denominator is null ("N/A"), never 0% or 100%;
 *  - penalty exposure is restricted to sanctions on applicable obligations.
 *
 * <p><b>Compliance score</b> — weighted mean of the components that have data (weights are the
 * tenant's {@code compliance_score_weights}, default 30/25/30/15):
 * <ol>
 *   <li>Control coverage — applicable obligations with ≥1 linked control;</li>
 *   <li>Control effectiveness — controls whose latest test passed ÷ all controls (untested ≠ effective);</li>
 *   <li>Returns on time — filings submitted on time ÷ filings due;</li>
 *   <li>Findings within SLA — closed within SLA or still inside the remediation deadline ÷ all findings.</li>
 * </ol>
 * A component with no data (no controls, nothing due, no findings) is left out and the remaining
 * weights re-normalised.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ComplianceMetricsService {

    private final ObligationClassificationRepository classifications;
    private final ObligationRepository obligations;
    private final ControlRepository controls;
    private final ControlTaskRepository controlTasks;
    private final ControlTestResultRepository controlTests;
    private final FindingRepository findings;
    private final ReturnFilingInstanceRepository returns;
    private final RegulatorySanctionRepository sanctions;
    private final ComplianceScoreWeightsRepository scoreWeights;

    private static final Set<String> HIGH_RISK = Set.of(WorkflowStatus.RISK_CRITICAL, WorkflowStatus.RISK_HIGH);
    private static final Set<String> OPEN_FINDING_STATUS = Set.of(WorkflowStatus.FINDING_OPEN, WorkflowStatus.FINDING_IN_REMEDIATION);
    private static final Set<String> HIGH_SEVERITY = Set.of(WorkflowStatus.RISK_CRITICAL, WorkflowStatus.RISK_HIGH);
    private static final Set<String> OPEN_TASK_STATUS = Set.of(
        WorkflowStatus.TASK_PENDING, WorkflowStatus.TASK_IN_PROGRESS, WorkflowStatus.TASK_OVERDUE);
    private static final int TESTS_DUE_WINDOW_DAYS = 30;

    static final String C_COVERAGE = "controlCoverage";
    static final String C_EFFECTIVENESS = "controlTests";   // weight key kept for stored tenant weights
    static final String C_RETURNS = "returnsOnTime";
    static final String C_FINDINGS = "findingsWithinSla";

    private static final Map<String, String[]> COMPONENT_TEXT = Map.of(
        C_COVERAGE, new String[]{"Control coverage", "Applicable obligations with at least one linked control"},
        C_EFFECTIVENESS, new String[]{"Control effectiveness", "Controls whose latest test passed ÷ all controls (an untested control is not yet effective)"},
        C_RETURNS, new String[]{"Returns on time", "Filings submitted on time ÷ filings due (submitted + overdue)"},
        C_FINDINGS, new String[]{"Findings within SLA", "Findings closed within SLA or still inside their remediation deadline ÷ all findings"});

    @Transactional(readOnly = true)
    public ComplianceMetricsDto compute(LocalDate fromIn, LocalDate toIn) {
        final LocalDate to = toIn != null ? toIn : LocalDate.now();
        final LocalDate from = fromIn != null ? fromIn : to.minusYears(1);

        List<ObligationClassification> allClassifications = classifications.findAll();
        Map<Long, Obligation> obligationById = obligations.findAll().stream()
            .collect(Collectors.toMap(Obligation::getObligationId, o -> o, (a, b) -> a));

        // ── Obligations ──
        List<ObligationClassification> applicable = allClassifications.stream()
            .filter(c -> "applicable".equals(c.getApplicability()))
            .toList();

        Map<String, Integer> byRisk = new TreeMap<>();
        Map<String, Integer> byArea = new TreeMap<>();
        Map<String, Integer> byAct = new TreeMap<>();
        int highRisk = 0;
        int gaps = 0;
        for (ObligationClassification c : applicable) {
            String risk = resolveRisk(c);
            byRisk.merge(risk, 1, Integer::sum);
            if (HIGH_RISK.contains(risk)) highRisk++;
            if (hasNoControl(c)) gaps++;

            // every applicable obligation lands in exactly one area and one act bucket
            Obligation o = c.getObligationId() != null ? obligationById.get(c.getObligationId()) : null;
            byArea.merge(AreasOfFocus.bucket(o != null ? o.getAreaOfFocus() : null), 1, Integer::sum);
            String act = o != null && o.getActName() != null && !o.getActName().isBlank() ? o.getActName() : AreasOfFocus.UNASSIGNED;
            byAct.merge(act, 1, Integer::sum);
        }

        long notApplicable = allClassifications.stream().filter(c -> "not_applicable".equals(c.getApplicability())).count();
        long underReview = allClassifications.stream().filter(c -> "under_review".equals(c.getApplicability())).count();

        int totalApplicable = applicable.size();
        int covered = totalApplicable - gaps;
        double coverage = totalApplicable > 0 ? (double) covered / totalApplicable * 100 : 0.0;

        // ── Controls ── (pass/fail from the latest test result per control)
        List<Control> allControls = controls.findAll();
        int controlsTotal = allControls.size();
        int controlsHighResidual = (int) allControls.stream()
            .filter(c -> HIGH_RISK.contains(c.getResidualRisk())).count();
        Map<Integer, ControlTestResult> latestTest = latestTestByControl(controlTests.findAll());
        Set<Integer> controlIds = allControls.stream().map(Control::getControlId).collect(Collectors.toSet());
        latestTest.keySet().retainAll(controlIds);
        int controlsTested = latestTest.size();
        int controlsPassing = (int) latestTest.values().stream()
            .filter(t -> WorkflowStatus.TEST_PASSED.equals(t.getResult())).count();
        int controlsFailing = (int) latestTest.values().stream()
            .filter(t -> WorkflowStatus.TEST_FAILED.equals(t.getResult()) || WorkflowStatus.TEST_PARTIAL.equals(t.getResult()))
            .count();
        Double testCoverage = pct(controlsTested, controlsTotal);
        Double effectivenessOfTested = pct(controlsPassing, controlsTested);
        Double effectivenessOfAll = pct(controlsPassing, controlsTotal);
        LocalDate todayDate = LocalDate.now();
        List<ControlTask> openTasks = controlTasks.findAll().stream()
            .filter(t -> OPEN_TASK_STATUS.contains(t.getStatus()) && t.getDueDate() != null)
            .toList();
        int testsDue = (int) openTasks.stream()
            .filter(t -> !t.getDueDate().isAfter(todayDate.plusDays(TESTS_DUE_WINDOW_DAYS))).count();
        int testsOverdue = (int) openTasks.stream().filter(t -> t.getDueDate().isBefore(todayDate)).count();

        // ── Returns ──
        List<ReturnFilingInstance> allInstances = returns.findAll();
        List<ReturnFilingInstance> periodInstances = allInstances.stream()
            .filter(i -> i.getDueDate() != null && !i.getDueDate().isBefore(from) && !i.getDueDate().isAfter(to))
            .toList();
        int onTime = (int) periodInstances.stream().filter(i -> i.getStatus() == ReturnFilingStatus.SUBMITTED).count();
        int late = (int) periodInstances.stream().filter(i -> i.getStatus() == ReturnFilingStatus.SUBMITTED_LATE).count();
        int pending = (int) periodInstances.stream().filter(i ->
            i.getStatus() == ReturnFilingStatus.NOT_STARTED || i.getStatus() == ReturnFilingStatus.IN_PROGRESS).count();
        int overdue = (int) allInstances.stream().filter(i ->
            i.getDueDate() != null && i.getDueDate().isBefore(LocalDate.now())
                && i.getStatus() != ReturnFilingStatus.SUBMITTED
                && i.getStatus() != ReturnFilingStatus.SUBMITTED_LATE).count();
        // Due = filed (on time or late) + still unfiled past the due date. A period not yet due is not a miss.
        int overdueInPeriod = (int) periodInstances.stream().filter(i ->
            i.getDueDate().isBefore(LocalDate.now())
                && i.getStatus() != ReturnFilingStatus.SUBMITTED
                && i.getStatus() != ReturnFilingStatus.SUBMITTED_LATE).count();
        int dueCount = onTime + late + overdueInPeriod;
        Double onTimePct = pct(onTime, dueCount);

        // ── Findings ──
        List<Finding> allFindings = findings.findAll();
        List<Finding> openFindings = allFindings.stream()
            .filter(f -> OPEN_FINDING_STATUS.contains(f.getStatus())).toList();
        int findingsHigh = (int) allFindings.stream()
            .filter(f -> HIGH_SEVERITY.contains(f.getSeverity()) && OPEN_FINDING_STATUS.contains(f.getStatus()))
            .count();
        LocalDate today = LocalDate.now();
        int overdueRemediation = (int) openFindings.stream()
            .filter(f -> f.getRemediationDeadline() != null && f.getRemediationDeadline().isBefore(today))
            .count();
        double withinSla = findingsWithinSla(allFindings, openFindings, today);
        List<ComplianceMetricsDto.FindingAge> ageing = findingsAgeing(openFindings, today);

        // ── Sanctions (applicable obligations only) ──
        Set<Long> applicableInstrumentIds = applicable.stream()
            .map(ObligationClassification::getInstrumentId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        BigDecimal exposure = BigDecimal.ZERO;
        Map<String, BigDecimal> exposureByAct = new TreeMap<>();
        for (var s : sanctions.findAll()) {
            if (s.getInstrumentId() == null || !applicableInstrumentIds.contains(s.getInstrumentId())) continue;
            BigDecimal amt = s.getSanctionAmountNaira() != null ? s.getSanctionAmountNaira() : BigDecimal.ZERO;
            exposure = exposure.add(amt);
            String act = s.getRegulationName() != null && !s.getRegulationName().isBlank() ? s.getRegulationName() : "Unmapped";
            exposureByAct.merge(act, amt, BigDecimal::add);
        }

        ComplianceScoreWeights w = scoreWeights.findFirstByOrderByWeightIdAsc()
            .orElseGet(() -> ComplianceScoreWeights.builder().build());

        // Score components are percentages (0..100); the weighted score blends only components
        // that have data, re-normalising the weights so a missing area never penalises the bank.
        Map<String, Double> components = new LinkedHashMap<>();
        boolean anyFindings = !allFindings.isEmpty();
        components.put(C_COVERAGE, totalApplicable > 0 ? coverage : null);
        components.put(C_EFFECTIVENESS, effectivenessOfAll);
        components.put(C_RETURNS, onTimePct);
        components.put(C_FINDINGS, anyFindings ? withinSla : null);

        Map<String, Integer> weights = new LinkedHashMap<>();
        weights.put(C_COVERAGE, w.getControlCoverage());
        weights.put(C_EFFECTIVENESS, w.getControlTests());
        weights.put(C_RETURNS, w.getReturnsOnTime());
        weights.put(C_FINDINGS, w.getFindingsWithinSla());

        Map<String, Boolean> hasData = new HashMap<>();
        components.forEach((k, v) -> hasData.put(k, v != null));
        Map<String, Double> scored = new LinkedHashMap<>();
        components.forEach((k, v) -> scored.put(k, v != null ? v : 0.0));

        Double score = computeScore(scored, weights, hasData);
        List<ComplianceMetricsDto.ScoreComponent> breakdown = new ArrayList<>();
        components.forEach((k, v) -> breakdown.add(ComplianceMetricsDto.ScoreComponent.builder()
            .key(k).label(COMPONENT_TEXT.get(k)[0]).definition(COMPONENT_TEXT.get(k)[1])
            .weight(weights.getOrDefault(k, 0)).value(v != null ? round(v) : null)
            .included(v != null && weights.getOrDefault(k, 0) > 0).build()));

        List<ComplianceMetricsDto.AttentionItem> attention = new ArrayList<>();
        long escalated = allInstances.stream().filter(i -> i.getEscalationLevel() != null && i.getEscalationLevel() > 0).count();
        if (escalated > 0) attention.add(item("returns", "Returns escalated to management", escalated, "high"));
        if (overdue > 0) attention.add(item("returns", "Overdue returns", overdue, "high"));
        if (overdueRemediation > 0) attention.add(item("findings", "Findings past remediation SLA", overdueRemediation, "high"));
        if (gaps > 0) attention.add(item("obligations", "High-risk obligations with no control", countHighRiskGaps(applicable), "medium"));
        if (controlsFailing > 0) attention.add(item("controls", "Controls failing their latest test", controlsFailing, "high"));
        if (testsOverdue > 0) attention.add(item("controls", "Control tests overdue", testsOverdue, "medium"));
        attention.sort(Comparator.comparingLong(ComplianceMetricsDto.AttentionItem::getCount).reversed());

        return ComplianceMetricsDto.builder()
            .periodFrom(from).periodTo(to)
            .obligationsTotal(allClassifications.size())
            .obligationsApplicable(totalApplicable)
            .obligationsNotApplicable((int) notApplicable)
            .obligationsUnderReview((int) underReview)
            .obligationsHighRisk(highRisk)
            .obligationsWithGaps(gaps)
            .obligationsByRisk(byRisk)
            .obligationsByArea(byArea)
            .obligationsByAct(byAct)
            .controlsTotal(controlsTotal)
            .controlsHighResidualRisk(controlsHighResidual)
            .controlsTested(controlsTested)
            .controlsUntested(controlsTotal - controlsTested)
            .controlsPassing(controlsPassing)
            .controlsFailing(controlsFailing)
            .controlTestsDue(testsDue)
            .controlTestsOverdue(testsOverdue)
            .controlCoverage(round(coverage))
            .controlTestCompletion(roundOrNull(testCoverage))
            .controlEffectivenessPct(roundOrNull(effectivenessOfTested))
            .returnsTotal(periodInstances.size())
            .returnsDue(dueCount)
            .returnsSubmittedOnTime(onTime)
            .returnsSubmittedLate(late)
            .returnsPending(pending)
            .returnsOverdue(overdue)
            .returnsOnTimePct(roundOrNull(onTimePct))
            .findingsOpen(openFindings.size())
            .findingsHighSeverity(findingsHigh)
            .findingsOverdueRemediation(overdueRemediation)
            .findingsWithinSlaPct(round(withinSla))
            .findingsAgeing(ageing)
            .penaltyExposureNaira(exposure)
            .exposureByAct(exposureByAct)
            .complianceScore(score)
            .scoreComponents(components)
            .scoreBreakdown(breakdown)
            .attentionItems(attention)
            .build();
    }

    /** Weighted average over the components that have data, re-normalising the weights. */
    public Double computeScore(Map<String, Double> components, Map<String, Integer> weights, Map<String, Boolean> hasData) {
        double weightedSum = 0;
        int weightTotal = 0;
        for (var e : components.entrySet()) {
            if (!Boolean.TRUE.equals(hasData.get(e.getKey()))) continue;
            int w = weights.getOrDefault(e.getKey(), 0);
            weightedSum += e.getValue() * w;
            weightTotal += w;
        }
        if (weightTotal == 0) return null;
        return round(weightedSum / weightTotal);
    }

    /** Latest result per control: newest test date, then highest test id. */
    static Map<Integer, ControlTestResult> latestTestByControl(List<ControlTestResult> results) {
        Map<Integer, ControlTestResult> latest = new HashMap<>();
        Comparator<ControlTestResult> newer = Comparator
            .comparing(ControlTestResult::getTestDate, Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(ControlTestResult::getTestId, Comparator.nullsFirst(Comparator.naturalOrder()));
        for (ControlTestResult r : results) {
            if (r.getControlId() == null) continue;
            latest.merge(r.getControlId(), r, (a, b) -> newer.compare(a, b) >= 0 ? a : b);
        }
        return latest;
    }

    /** part ÷ whole as a percentage, or null when the denominator is empty. */
    static Double pct(int part, int whole) {
        return whole > 0 ? (double) part / whole * 100 : null;
    }

    private double findingsWithinSla(List<Finding> all, List<Finding> open, LocalDate today) {
        // Closed findings that met their SLA (closedAt within createdAt + slaDays),
        // plus open findings not yet past their remediation deadline.
        long closedOnTime = all.stream()
            .filter(f -> f.getClosedAt() != null && f.getCreatedAt() != null && f.getSlaDays() != null)
            .filter(f -> !f.getClosedAt().isAfter(f.getCreatedAt().plus(java.time.Duration.ofDays(f.getSlaDays()))))
            .count();
        long closedCount = all.stream().filter(f -> f.getClosedAt() != null).count();
        long openWithinSla = open.stream()
            .filter(f -> f.getRemediationDeadline() == null || !f.getRemediationDeadline().isBefore(today))
            .count();
        long total = closedCount + open.size();
        if (total == 0) return 100.0;
        return (double) (closedOnTime + openWithinSla) / total * 100;
    }

    private List<ComplianceMetricsDto.FindingAge> findingsAgeing(List<Finding> open, LocalDate today) {
        Map<String, List<Finding>> bySeverity = open.stream()
            .collect(Collectors.groupingBy(f -> f.getSeverity() != null ? f.getSeverity() : "Unknown"));
        List<ComplianceMetricsDto.FindingAge> out = new ArrayList<>();
        bySeverity.forEach((sev, list) -> {
            double avg = list.stream()
                .filter(f -> f.getCreatedAt() != null)
                .mapToLong(f -> ChronoUnit.DAYS.between(f.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toLocalDate(), today))
                .average().orElse(0);
            out.add(ComplianceMetricsDto.FindingAge.builder()
                .severity(sev).count(list.size()).averageAgeDays(round(avg)).build());
        });
        out.sort(Comparator.comparingLong(ComplianceMetricsDto.FindingAge::getCount).reversed());
        return out;
    }

    private long countHighRiskGaps(List<ObligationClassification> applicable) {
        return applicable.stream().filter(c -> hasNoControl(c) && HIGH_RISK.contains(resolveRisk(c))).count();
    }

    /** ONE gap definition: an applicable obligation with no linked control. */
    private boolean hasNoControl(ObligationClassification c) {
        return c.getLinkedControlIds() == null || c.getLinkedControlIds().isEmpty();
    }

    private String resolveRisk(ObligationClassification c) {
        if (c.getInherentRiskRating() != null && !c.getInherentRiskRating().isBlank()) return c.getInherentRiskRating();
        if (c.getTenantRiskRating() != null && !c.getTenantRiskRating().isBlank()) return c.getTenantRiskRating();
        return "Unrated";
    }

    private ComplianceMetricsDto.AttentionItem item(String category, String label, long count, String severity) {
        return ComplianceMetricsDto.AttentionItem.builder()
            .category(category).label(label).count(count).severity(severity).build();
    }

    private static Double roundOrNull(Double v) {
        return v == null ? null : round(v);
    }

    private static double round(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }
}