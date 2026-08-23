package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.dashboard.dto.*;
import com.atheris.compliance.tenant.backend.modules.dashboard.entity.DashboardThreshold;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.DashboardThresholdRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.*;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class DashboardV2Service {

    private final ReturnFilingInstanceRepository returnsRepo;
    private final RegulatoryReturnRepository regReturns;
    private final ObligationClassificationRepository obligations;
    private final ObligationRepository obligationRepo;
    private final ControlRepository controls;
    private final DashboardThresholdRepository thresholds;

    private static final int APPROACHING_WINDOWS_DAYS_1 = 3;
    private static final int APPROACHING_WINDOWS_DAYS_2 = 7;
    private static final int APPROACHING_WINDOWS_DAYS_3 = 14;
    private static final int APPROACHING_WINDOWS_DAYS_4 = 30;

    private Map<Long, String> buildAreaOfFocusMap() {
        return obligationRepo.findAll().stream()
            .collect(Collectors.toMap(Obligation::getObligationId,
                o -> o.getAreaOfFocus() != null ? o.getAreaOfFocus() : "Unassigned",
                (a, b) -> a));
    }

    private boolean hasNoControl(ObligationClassification oc) {
        return oc.getLinkedControlIds() == null || oc.getLinkedControlIds().isEmpty();
    }

    private String resolveArea(Map<Long, String> aofMap, ObligationClassification oc) {
        String area = aofMap.get(oc.getObligationId());
        return area != null ? area : "Unassigned";
    }

    public ReturnsByPeriodDto getReturnsByPeriod(LocalDate from, LocalDate to) {
        List<ReturnFilingInstance> instances = returnsRepo.findByDueDateBetweenOrderByDueDateAsc(from, to);
        LocalDate today = LocalDate.now();
        LocalDate approaching30 = today.plusDays(APPROACHING_WINDOWS_DAYS_4);

        Map<Long, RegulatoryReturn> returnMap = regReturns.findAll().stream()
            .collect(Collectors.toMap(RegulatoryReturn::getReturnId, r -> r));

        Map<String, ReturnsByPeriodDto.PeriodRow> periodMap = new LinkedHashMap<>();

        for (ReturnFilingInstance inst : instances) {
            String key = inst.getPeriod() != null ? inst.getPeriod() : "Unknown";
            RegulatoryReturn regReturn = returnMap.get(inst.getReturnId());
            String regName = regReturn != null ? regReturn.getFilingRegulator() : "Unknown";
            String freq = regReturn != null ? regReturn.getFrequency() : "Unknown";
            Long retId = inst.getReturnId();

            String groupKey = key + "|" + regName + "|" + freq + "|" + retId;
            ReturnsByPeriodDto.PeriodRow row = periodMap.computeIfAbsent(groupKey, k ->
                ReturnsByPeriodDto.PeriodRow.builder()
                    .period(key)
                    .frequency(freq)
                    .regulator(regName)
                    .returnId(retId)
                    .build()
            );

            row.setTotal(row.getTotal() + 1);
            switch (inst.getStatus()) {
                case SUBMITTED -> row.setSubmitted(row.getSubmitted() + 1);
                case SUBMITTED_LATE -> row.setSubmittedLate(row.getSubmittedLate() + 1);
                case IN_PROGRESS -> row.setInProgress(row.getInProgress() + 1);
                case NOT_STARTED -> row.setNotStarted(row.getNotStarted() + 1);
            }

            if (inst.getStatus() != ReturnFilingStatus.SUBMITTED
                && inst.getStatus() != ReturnFilingStatus.SUBMITTED_LATE
                && inst.getDueDate() != null && inst.getDueDate().isBefore(today)) {
                row.setOverdue(row.getOverdue() + 1);
            }
        }

        List<ReturnsByPeriodDto.PeriodRow> rows = new ArrayList<>(periodMap.values());
        for (ReturnsByPeriodDto.PeriodRow row : rows) {
            int completed = row.getSubmitted();
            int total = row.getTotal();
            double pct = total > 0 ? (double) completed / total * 100 : 0;
            row.setOnTimePercentage(Math.round(pct * 10.0) / 10.0);
            row.setColor(resolveColor(pct, "returns_on_time", 90, 70));
        }

        int totalInstances = rows.stream().mapToInt(ReturnsByPeriodDto.PeriodRow::getTotal).sum();
        int totalSubmitted = rows.stream().mapToInt(ReturnsByPeriodDto.PeriodRow::getSubmitted).sum();
        int totalPending = rows.stream().mapToInt(r -> r.getInProgress() + r.getNotStarted()).sum();
        int totalOverdue = rows.stream().mapToInt(ReturnsByPeriodDto.PeriodRow::getOverdue).sum();
        double overallPct = totalInstances > 0 ? (double) totalSubmitted / totalInstances * 100 : 0;

        int approaching = (int) instances.stream()
            .filter(i -> i.getStatus() != ReturnFilingStatus.SUBMITTED
                && i.getStatus() != ReturnFilingStatus.SUBMITTED_LATE
                && i.getDueDate() != null
                && i.getDueDate().isAfter(today)
                && i.getDueDate().isBefore(approaching30))
            .count();

        ReturnsByPeriodDto.Summary summary = ReturnsByPeriodDto.Summary.builder()
            .totalInstances(totalInstances)
            .totalSubmitted(totalSubmitted)
            .totalOnTime(totalSubmitted)
            .totalPending(totalPending)
            .totalOverdue(totalOverdue)
            .overallOnTimePercentage(Math.round(overallPct * 10.0) / 10.0)
            .overallColor(resolveColor(overallPct, "returns_on_time", 90, 70))
            .approachingDeadlines(approaching)
            .build();

        return ReturnsByPeriodDto.builder().periods(rows).summary(summary).build();
    }

    public ControlCoverageDto getControlCoverageByAreaOfFocus() {
        List<ObligationClassification> all = obligations.findAll().stream()
            .filter(c -> "applicable".equals(c.getApplicability()))
            .toList();
        Map<Long, String> aofMap = buildAreaOfFocusMap();

        Map<String, ControlCoverageDto.CoverageRow> map = new LinkedHashMap<>();
        for (ObligationClassification oc : all) {
            String area = resolveArea(aofMap, oc);
            ControlCoverageDto.CoverageRow row = map.computeIfAbsent(area, k ->
                ControlCoverageDto.CoverageRow.builder().name(k).build());
            row.setTotalObligations(row.getTotalObligations() + 1);
            if (hasNoControl(oc)) {
                row.setGaps(row.getGaps() + 1);
            } else {
                row.setCovered(row.getCovered() + 1);
            }
        }
        return buildCoverageResult("Area of Focus", map);
    }

    public ControlCoverageDto getControlCoverageByDepartment() {
        List<ObligationClassification> all = obligations.findAll().stream()
            .filter(c -> "applicable".equals(c.getApplicability()))
            .toList();

        Map<String, ControlCoverageDto.CoverageRow> map = new LinkedHashMap<>();
        for (ObligationClassification oc : all) {
            String dept = oc.getAssignedDepartment() != null && !oc.getAssignedDepartment().isBlank()
                ? oc.getAssignedDepartment() : "Unassigned";
            ControlCoverageDto.CoverageRow row = map.computeIfAbsent(dept, k ->
                ControlCoverageDto.CoverageRow.builder().name(k).build());
            row.setTotalObligations(row.getTotalObligations() + 1);
            if (hasNoControl(oc)) {
                row.setGaps(row.getGaps() + 1);
            } else {
                row.setCovered(row.getCovered() + 1);
            }
        }
        return buildCoverageResult("Department", map);
    }

    private ControlCoverageDto buildCoverageResult(String dimension, Map<String, ControlCoverageDto.CoverageRow> map) {
        List<ControlCoverageDto.CoverageRow> rows = new ArrayList<>(map.values());
        for (ControlCoverageDto.CoverageRow row : rows) {
            double pct = row.getTotalObligations() > 0
                ? (double) row.getCovered() / row.getTotalObligations() * 100 : 0;
            row.setCoveragePercentage(Math.round(pct * 10.0) / 10.0);
            row.setColor(resolveColor(pct, "control_coverage", 80, 60));
        }
        int totalObligations = rows.stream().mapToInt(ControlCoverageDto.CoverageRow::getTotalObligations).sum();
        int totalCovered = rows.stream().mapToInt(ControlCoverageDto.CoverageRow::getCovered).sum();
        int totalGaps = rows.stream().mapToInt(ControlCoverageDto.CoverageRow::getGaps).sum();
        double overallPct = totalObligations > 0 ? (double) totalCovered / totalObligations * 100 : 0;

        return ControlCoverageDto.builder()
            .dimension(dimension)
            .rows(rows)
            .summary(ControlCoverageDto.Summary.builder()
                .totalObligations(totalObligations)
                .totalCovered(totalCovered)
                .totalGaps(totalGaps)
                .overallCoveragePercentage(Math.round(overallPct * 10.0) / 10.0)
                .overallColor(resolveColor(overallPct, "control_coverage", 80, 60))
                .build())
            .build();
    }

    public RiskProfileDto getRiskProfile() {
        List<ObligationClassification> all = obligations.findAll().stream()
            .filter(c -> "applicable".equals(c.getApplicability()))
            .toList();
        Map<Long, String> aofMap = buildAreaOfFocusMap();

        Map<String, Integer> riskCounts = new LinkedHashMap<>();
        riskCounts.put("Extreme", 0);
        riskCounts.put("High", 0);
        riskCounts.put("Medium", 0);
        riskCounts.put("Low", 0);

        for (ObligationClassification oc : all) {
            String risk = oc.getInherentRiskRating() != null ? oc.getInherentRiskRating()
                : (oc.getTenantRiskRating() != null ? oc.getTenantRiskRating() : "Low");
            riskCounts.merge(risk, 1, Integer::sum);
        }

        int total = all.size();
        List<RiskProfileDto.RiskRow> riskRows = riskCounts.entrySet().stream()
            .map(e -> RiskProfileDto.RiskRow.builder()
                .level(e.getKey())
                .count(e.getValue())
                .percentage(total > 0 ? Math.round((double) e.getValue() / total * 1000.0) / 10.0 : 0)
                .build())
            .toList();

        Map<String, RiskProfileDto.AreaRow> areaMap = new LinkedHashMap<>();
        for (ObligationClassification oc : all) {
            String area = resolveArea(aofMap, oc);
            RiskProfileDto.AreaRow row = areaMap.computeIfAbsent(area, k ->
                RiskProfileDto.AreaRow.builder().areaOfFocus(k).build());
            row.setTotal(row.getTotal() + 1);
            String risk = oc.getInherentRiskRating() != null ? oc.getInherentRiskRating()
                : (oc.getTenantRiskRating() != null ? oc.getTenantRiskRating() : "Low");
            switch (risk) {
                case "Extreme" -> row.setExtreme(row.getExtreme() + 1);
                case "High" -> row.setHigh(row.getHigh() + 1);
                case "Medium" -> row.setMedium(row.getMedium() + 1);
                default -> row.setLow(row.getLow() + 1);
            }
            if (hasNoControl(oc)) {
                row.setGaps(row.getGaps() + 1);
            }
        }

        int gapsCount = (int) all.stream().filter(this::hasNoControl).count();

        return RiskProfileDto.builder()
            .riskLevels(riskRows)
            .byAreaOfFocus(new ArrayList<>(areaMap.values()))
            .summary(RiskProfileDto.Summary.builder()
                .totalApplicable(total)
                .extremeCount(riskCounts.getOrDefault("Extreme", 0))
                .highCount(riskCounts.getOrDefault("High", 0))
                .mediumCount(riskCounts.getOrDefault("Medium", 0))
                .lowCount(riskCounts.getOrDefault("Low", 0))
                .gapsCount(gapsCount)
                .build())
            .build();
    }

    public ThresholdDto getThresholds(Long tenantId) {
        List<DashboardThreshold> saved = thresholds.findByTenantId(tenantId);
        if (saved.isEmpty()) return ThresholdDto.defaults();

        Map<String, ThresholdDto.ThresholdRange> map = new LinkedHashMap<>();
        for (DashboardThreshold t : saved) {
            map.put(t.getMetricName(), new ThresholdDto.ThresholdRange(t.getGreenMin(), t.getAmberMin()));
        }
        return ThresholdDto.builder().thresholds(map).build();
    }

    @Transactional
    public void saveThresholds(Long tenantId, ThresholdDto dto) {
        thresholds.deleteByTenantId(tenantId);
        if (dto.getThresholds() == null) return;
        for (Map.Entry<String, ThresholdDto.ThresholdRange> entry : dto.getThresholds().entrySet()) {
            ThresholdDto.ThresholdRange range = entry.getValue();
            thresholds.save(DashboardThreshold.builder()
                .tenantId(tenantId)
                .metricName(entry.getKey())
                .greenMin(range.getGreen())
                .amberMin(range.getAmber())
                .build());
        }
    }

    private String resolveColor(double pct, String metric, double defaultGreen, double defaultAmber) {
        if (pct >= defaultGreen) return "green";
        if (pct >= defaultAmber) return "amber";
        return "red";
    }
}
