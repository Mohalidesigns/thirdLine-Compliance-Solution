package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.dashboard.dto.*;
import com.atheris.compliance.tenant.backend.modules.dashboard.entity.DashboardThreshold;
import com.atheris.compliance.tenant.backend.modules.dashboard.entity.RiskMatrixConfig;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.DashboardThresholdRepository;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.RiskMatrixConfigRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.org.entity.Department;
import com.atheris.compliance.tenant.backend.modules.org.repository.DepartmentRepository;
import com.atheris.compliance.tenant.backend.modules.returns.entity.*;
import com.atheris.compliance.tenant.backend.modules.returns.repository.RegulatoryReturnRepository;
import com.atheris.compliance.tenant.backend.modules.returns.repository.ReturnFilingInstanceRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
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
    private final RiskMatrixConfigRepository riskMatrixConfig;
    private final TenantIdentityService tenantIdentity;
    private final DepartmentRepository departmentRepo;

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

    private RiskMatrixConfig getConfig() {
        Long tenantId = tenantIdentity.currentTenantId();
        return riskMatrixConfig.findByTenantId(tenantId)
            .orElse(RiskMatrixConfig.builder().tenantId(tenantId).build());
    }

    // ------------------------------------------------------------------ returns by period (legacy)

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
                    .period(key).frequency(freq).regulator(regName).returnId(retId).build());

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
            .totalInstances(totalInstances).totalSubmitted(totalSubmitted).totalOnTime(totalSubmitted)
            .totalPending(totalPending).totalOverdue(totalOverdue)
            .overallOnTimePercentage(Math.round(overallPct * 10.0) / 10.0)
            .overallColor(resolveColor(overallPct, "returns_on_time", 90, 70))
            .approachingDeadlines(approaching).build();

        return ReturnsByPeriodDto.builder().periods(rows).summary(summary).build();
    }

    // ------------------------------------------------------------------ rendition grid

    public RenditionGridDto getRenditionGrid(LocalDate from, LocalDate to, String groupBy) {
        List<ReturnFilingInstance> instances = returnsRepo.findByDueDateBetweenOrderByDueDateAsc(from, to);
        Map<Long, RegulatoryReturn> returnMap = regReturns.findAll().stream()
            .collect(Collectors.toMap(RegulatoryReturn::getReturnId, r -> r));
        Map<Long, Obligation> obligationMap = obligationRepo.findAll().stream()
            .filter(o -> o.getInstrumentId() != null)
            .collect(Collectors.toMap(Obligation::getObligationId, o -> o, (a, b) -> a));
        List<ObligationRepository.ObligationReturnRow> returnLinks =
            obligationRepo.findAllReturnLinks();
        Map<Long, Set<Long>> returnIdToObligationIds = new HashMap<>();
        for (var link : returnLinks) {
            returnIdToObligationIds.computeIfAbsent(link.getReturnId(), k -> new HashSet<>()).add(link.getObligationId());
        }
        Map<Long, String> aofMap = buildAreaOfFocusMap();

        Map<String, Map<Long, RegulatoryReturn>> groupedReturns = new LinkedHashMap<>();
        Map<String, Map<Long, Map<String, ReturnFilingInstance>>> gridData = new LinkedHashMap<>();

        for (ReturnFilingInstance inst : instances) {
            RegulatoryReturn rr = returnMap.get(inst.getReturnId());
            if (rr == null) continue;

            String groupName;
            if ("areaOfFocus".equals(groupBy)) {
                Set<Long> oblIds = returnIdToObligationIds.getOrDefault(inst.getReturnId(), Set.of());
                groupName = oblIds.stream()
                    .map(aofMap::get)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse("Unassigned");
            } else {
                groupName = resolveDepartmentName(rr.getDepartmentId());
            }

            groupedReturns.computeIfAbsent(groupName, k -> new LinkedHashMap<>())
                .putIfAbsent(inst.getReturnId(), rr);
            gridData.computeIfAbsent(groupName, k -> new LinkedHashMap<>())
                .computeIfAbsent(inst.getReturnId(), k -> new LinkedHashMap<>())
                .put(inst.getPeriod(), inst);
        }

        List<String> months = getMonthRange(from, to);
        List<RenditionGridDto.GroupRow> groups = new ArrayList<>();
        int totalSubmitted = 0, totalOverdue = 0, totalPending = 0;
        LocalDate today = LocalDate.now();

        for (Map.Entry<String, Map<Long, RegulatoryReturn>> entry : groupedReturns.entrySet()) {
            String groupName = entry.getKey();
            List<RenditionGridDto.ReturnRow> returnRows = new ArrayList<>();
            int gSubmitted = 0, gOverdue = 0;

            for (Map.Entry<Long, RegulatoryReturn> retEntry : entry.getValue().entrySet()) {
                Long returnId = retEntry.getKey();
                RegulatoryReturn rr = retEntry.getValue();
                Map<String, ReturnFilingInstance> periodMap = gridData.getOrDefault(groupName, Map.of())
                    .getOrDefault(returnId, Map.of());

                List<RenditionGridDto.CellStatus> cells = new ArrayList<>();
                for (String month : months) {
                    ReturnFilingInstance inst = periodMap.get(month);
                    if (inst == null) {
                        cells.add(RenditionGridDto.CellStatus.builder()
                            .period(month).status("N/A").build());
                    } else {
                        String status = inst.getStatus().name();
                        cells.add(RenditionGridDto.CellStatus.builder()
                            .period(month)
                            .status(status)
                            .dueDate(inst.getDueDate() != null ? inst.getDueDate().toString() : null)
                            .build());
                        if ("SUBMITTED".equals(status)) gSubmitted++;
                        else if (inst.getDueDate() != null && inst.getDueDate().isBefore(today)) gOverdue++;
                        else totalPending++;
                    }
                }

                returnRows.add(RenditionGridDto.ReturnRow.builder()
                    .returnId(returnId)
                    .returnName(rr.getReturnName())
                    .regulator(rr.getFilingRegulator())
                    .cells(cells)
                    .build());
            }
            totalSubmitted += gSubmitted;
            totalOverdue += gOverdue;

            groups.add(RenditionGridDto.GroupRow.builder()
                .name(groupName)
                .returns(returnRows)
                .groupSummary(RenditionGridDto.GroupSummary.builder()
                    .total(returnRows.size())
                    .submitted(gSubmitted)
                    .overdue(gOverdue)
                    .build())
                .build());
        }

        return RenditionGridDto.builder()
            .groupBy(groupBy)
            .months(months)
            .groups(groups)
            .summary(RenditionGridDto.Summary.builder()
                .totalReturns(groups.stream().mapToInt(g -> g.getReturns().size()).sum())
                .totalSubmitted(totalSubmitted)
                .totalOverdue(totalOverdue)
                .totalPending(totalPending)
                .build())
            .build();
    }

    // ------------------------------------------------------------------ risk heatmap

    public RiskHeatmapDto getRiskHeatmap(String view) {
        RiskMatrixConfig config = getConfig();
        List<String> impacts = config.getImpactLevels();
        List<String> likelihoods = config.getLikelihoodLevels();
        Map<String, Integer> bands = config.getBandThresholds();

        List<ObligationClassification> all = obligations.findAll().stream()
            .filter(c -> "applicable".equals(c.getApplicability()))
            .toList();
        Map<Long, Boolean> gapMap = all.stream()
            .collect(Collectors.toMap(ObligationClassification::getObligationId,
                oc -> hasNoControl(oc), (a, b) -> a));

        Map<String, Map<String, RiskHeatmapDto.HeatmapCell>> cellMap = new LinkedHashMap<>();
        for (String impact : impacts) {
            cellMap.put(impact, new LinkedHashMap<>());
            for (String likelihood : likelihoods) {
                int impactIdx = impacts.indexOf(impact) + 1;
                int likelihoodIdx = likelihoods.indexOf(likelihood) + 1;
                int score = impactIdx * likelihoodIdx;
                String band = resolveBand(score, bands);
                cellMap.get(impact).put(likelihood, RiskHeatmapDto.HeatmapCell.builder()
                    .impact(impact)
                    .likelihood(likelihood)
                    .score(score)
                    .count(0)
                    .band(band)
                    .build());
            }
        }

        for (ObligationClassification oc : all) {
            String impact = "residual".equals(view) ? oc.getResidualRiskRating() : oc.getImpactRating();
            String likelihood = oc.getLikelihoodRating();
            if (impact == null || likelihood == null) continue;
            if (!impacts.contains(impact) || !likelihoods.contains(likelihood)) continue;

            RiskHeatmapDto.HeatmapCell cell = cellMap.get(impact).get(likelihood);
            cell.setCount(cell.getCount() + 1);
            if (Boolean.TRUE.equals(gapMap.get(oc.getObligationId()))) {
                cell.setHasGaps(true);
            }
        }

        List<RiskHeatmapDto.HeatmapCell> cells = new ArrayList<>();
        int total = 0, low = 0, moderate = 0, high = 0, critical = 0;
        for (String impact : impacts) {
            for (String likelihood : likelihoods) {
                RiskHeatmapDto.HeatmapCell cell = cellMap.get(impact).get(likelihood);
                cells.add(cell);
                total += cell.getCount();
                switch (cell.getBand()) {
                    case "Low" -> low += cell.getCount();
                    case "Moderate" -> moderate += cell.getCount();
                    case "High" -> high += cell.getCount();
                    case "Critical" -> critical += cell.getCount();
                }
            }
        }

        return RiskHeatmapDto.builder()
            .impactLevels(impacts)
            .likelihoodLevels(likelihoods)
            .cells(cells)
            .summary(RiskHeatmapDto.Summary.builder()
                .total(total).low(low).moderate(moderate).high(high).critical(critical)
                .build())
            .bandColors(Map.of("Low", "#4CAF50", "Moderate", "#FFC107", "High", "#FF9800", "Critical", "#F44336"))
            .build();
    }

    private String resolveBand(int score, Map<String, Integer> bands) {
        int critical = bands.getOrDefault("critical", 18);
        int high = bands.getOrDefault("high", 12);
        int moderate = bands.getOrDefault("moderate", 6);
        if (score > critical) return "Critical";
        if (score > high) return "High";
        if (score > moderate) return "Moderate";
        return "Low";
    }

    // ------------------------------------------------------------------ escalation matrix

    public EscalationMatrixDto getEscalationMatrix() {
        List<ReturnFilingInstance> escalated = returnsRepo.findAll().stream()
            .filter(i -> i.getEscalationLevel() != null && i.getEscalationLevel() > 0)
            .sorted(Comparator.comparingInt(ReturnFilingInstance::getEscalationLevel).reversed())
            .toList();

        Map<Long, RegulatoryReturn> returnMap = regReturns.findAll().stream()
            .collect(Collectors.toMap(RegulatoryReturn::getReturnId, r -> r));
        Map<Integer, Department> deptMap = departmentRepo.findAll().stream()
            .collect(Collectors.toMap(Department::getDepartmentId, d -> d, (a, b) -> a));
        Map<Long, String> aofMap = buildAreaOfFocusMap();

        List<EscalationMatrixDto.EscalationRow> rows = new ArrayList<>();
        int l1 = 0, l2 = 0, l3 = 0;

        for (ReturnFilingInstance inst : escalated) {
            RegulatoryReturn rr = returnMap.get(inst.getReturnId());
            if (rr == null) continue;

            Department dept = rr.getDepartmentId() != null ? deptMap.get(rr.getDepartmentId()) : null;
            String areaOfFocus = resolveAreaForReturn(inst.getReturnId(), aofMap);

            String label = switch (inst.getEscalationLevel()) {
                case 1 -> { l1++; yield "L1 - Analyst"; }
                case 2 -> { l2++; yield "L2 - Manager"; }
                case 3 -> { l3++; yield "L3 - CCO"; }
                default -> "None";
            };

            rows.add(EscalationMatrixDto.EscalationRow.builder()
                .returnId(inst.getReturnId())
                .returnName(rr.getReturnName())
                .regulator(rr.getFilingRegulator())
                .department(dept != null ? dept.getName() : "Unassigned")
                .areaOfFocus(areaOfFocus)
                .returnOwner(rr.getReturnOwnerName())
                .departmentHead(dept != null ? dept.getHeadOwnerId() != null ? "Dept Head" : null : null)
                .escalationLevel(inst.getEscalationLevel())
                .escalationLabel(label)
                .daysLate(inst.getDaysLate() != null ? inst.getDaysLate() : 0)
                .escalatedAt(inst.getEscalatedAt())
                .dueDate(inst.getDueDate() != null ? inst.getDueDate().toString() : null)
                .period(inst.getPeriod())
                .build());
        }

        return EscalationMatrixDto.builder()
            .escalations(rows)
            .summary(EscalationMatrixDto.Summary.builder()
                .total(rows.size()).l1(l1).l2(l2).l3(l3)
                .build())
            .build();
    }

    private String resolveAreaForReturn(Long returnId, Map<Long, String> aofMap) {
        List<ObligationRepository.ObligationReturnRow> links =
            obligationRepo.findAllReturnLinks();
        return links.stream()
            .filter(l -> l.getReturnId().equals(returnId))
            .map(l -> aofMap.getOrDefault(l.getObligationId(), "Unassigned"))
            .findFirst()
            .orElse("Unassigned");
    }

    // ------------------------------------------------------------------ control coverage

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
            if (hasNoControl(oc)) row.setGaps(row.getGaps() + 1);
            else row.setCovered(row.getCovered() + 1);
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
            if (hasNoControl(oc)) row.setGaps(row.getGaps() + 1);
            else row.setCovered(row.getCovered() + 1);
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

    // ------------------------------------------------------------------ risk profile (legacy, kept for backward compat)

    public RiskProfileDto getRiskProfile() {
        List<ObligationClassification> all = obligations.findAll().stream()
            .filter(c -> "applicable".equals(c.getApplicability()))
            .toList();
        Map<Long, String> aofMap = buildAreaOfFocusMap();

        Map<String, Integer> riskCounts = new LinkedHashMap<>();
        riskCounts.put("Critical", 0);
        riskCounts.put("High", 0);
        riskCounts.put("Moderate", 0);
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
                case "Critical" -> row.setExtreme(row.getExtreme() + 1);
                case "High" -> row.setHigh(row.getHigh() + 1);
                case "Moderate" -> row.setMedium(row.getMedium() + 1);
                default -> row.setLow(row.getLow() + 1);
            }
            if (hasNoControl(oc)) row.setGaps(row.getGaps() + 1);
        }

        int gapsCount = (int) all.stream().filter(this::hasNoControl).count();

        return RiskProfileDto.builder()
            .riskLevels(riskRows)
            .byAreaOfFocus(new ArrayList<>(areaMap.values()))
            .summary(RiskProfileDto.Summary.builder()
                .totalApplicable(total)
                .extremeCount(riskCounts.getOrDefault("Critical", 0))
                .highCount(riskCounts.getOrDefault("High", 0))
                .mediumCount(riskCounts.getOrDefault("Moderate", 0))
                .lowCount(riskCounts.getOrDefault("Low", 0))
                .gapsCount(gapsCount)
                .build())
            .build();
    }

    // ------------------------------------------------------------------ thresholds

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

    // ------------------------------------------------------------------ helpers

    private String resolveDepartmentName(Integer departmentId) {
        if (departmentId == null) return "Unassigned";
        return departmentRepo.findById(departmentId)
            .map(Department::getName)
            .orElse("Unassigned");
    }

    private List<String> getMonthRange(LocalDate from, LocalDate to) {
        List<String> months = new ArrayList<>();
        YearMonth start = YearMonth.from(from);
        YearMonth end = YearMonth.from(to);
        while (!start.isAfter(end)) {
            months.add(start.toString());
            start = start.plusMonths(1);
        }
        return months;
    }

    private String resolveColor(double pct, String metric, double defaultGreen, double defaultAmber) {
        if (pct >= defaultGreen) return "green";
        if (pct >= defaultAmber) return "amber";
        return "red";
    }
}
