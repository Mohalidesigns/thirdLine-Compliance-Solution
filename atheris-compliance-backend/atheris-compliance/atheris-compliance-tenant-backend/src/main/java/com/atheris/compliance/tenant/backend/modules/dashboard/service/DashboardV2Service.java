package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.common.taxonomy.AreasOfFocus;
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

    private static final List<String> DEFAULT_IMPACT_LEVELS =
        List.of("Low", "Medium", "High", "Critical");
    private static final List<String> DEFAULT_LIKELIHOOD_LEVELS =
        List.of("Rare", "Unlikely", "Possible", "Likely", "Almost Certain");

    private Map<Long, String> buildAreaOfFocusMap() {
        return obligationRepo.findAll().stream()
            .collect(Collectors.toMap(Obligation::getObligationId,
                o -> AreasOfFocus.bucket(o.getAreaOfFocus()),
                (a, b) -> a));
    }

    private Map<Long, String> buildActMap() {
        return obligationRepo.findAll().stream()
            .collect(Collectors.toMap(Obligation::getObligationId,
                o -> o.getActName() != null && !o.getActName().isBlank() ? o.getActName() : "Unassigned",
                (a, b) -> a));
    }

    private boolean hasNoControl(ObligationClassification oc) {
        return oc.getLinkedControlIds() == null || oc.getLinkedControlIds().isEmpty();
    }

    private String resolveArea(Map<Long, String> aofMap, ObligationClassification oc) {
        String area = aofMap.get(oc.getObligationId());
        return area != null ? area : "Unassigned";
    }

    private String resolveAct(Map<Long, String> actMap, ObligationClassification oc) {
        String act = actMap.get(oc.getObligationId());
        return act != null ? act : "Unassigned";
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

        Map<String, ThresholdDto.ThresholdRange> thresholdConfig = loadThresholds();
        List<ReturnsByPeriodDto.PeriodRow> rows = new ArrayList<>(periodMap.values());
        for (ReturnsByPeriodDto.PeriodRow row : rows) {
            int completed = row.getSubmitted();
            int total = row.getTotal();
            double pct = total > 0 ? (double) completed / total * 100 : 0;
            row.setOnTimePercentage(Math.round(pct * 10.0) / 10.0);
            row.setColor(resolveColor(thresholdConfig, pct, "returns_on_time", 90, 70));
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
            .overallColor(resolveColor(thresholdConfig, overallPct, "returns_on_time", 90, 70))
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

        // One query for all departments (avoids an N+1 in the department grouping below).
        Map<Integer, String> deptNames = departmentRepo.findAll().stream()
            .collect(Collectors.toMap(Department::getDepartmentId, Department::getName, (a, b) -> a));

        Map<String, Map<Long, RegulatoryReturn>> groupedReturns = new LinkedHashMap<>();
        // group → return → month column → every instance due in that month. Daily and weekly
        // returns have several periods per month (period labels "2026-10-16" / "2026-W42"), so
        // the grid buckets by the due date's month instead of looking the period label up.
        Map<String, Map<Long, Map<String, List<ReturnFilingInstance>>>> gridData = new LinkedHashMap<>();

        for (ReturnFilingInstance inst : instances) {
            RegulatoryReturn rr = returnMap.get(inst.getReturnId());
            if (rr == null) continue;
            String month = monthKey(inst);
            if (month == null) continue;

            String groupName;
            if ("areaOfFocus".equals(groupBy)) {
                Set<Long> oblIds = returnIdToObligationIds.getOrDefault(inst.getReturnId(), Set.of());
                groupName = oblIds.stream()
                    .map(aofMap::get)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse("Unassigned");
            } else {
                groupName = resolveDepartmentName(deptNames, rr.getDepartmentId());
            }

            groupedReturns.computeIfAbsent(groupName, k -> new LinkedHashMap<>())
                .putIfAbsent(inst.getReturnId(), rr);
            gridData.computeIfAbsent(groupName, k -> new LinkedHashMap<>())
                .computeIfAbsent(inst.getReturnId(), k -> new LinkedHashMap<>())
                .computeIfAbsent(month, k -> new ArrayList<>())
                .add(inst);
        }

        List<String> months = getMonthRange(from, to);
        List<RenditionGridDto.GroupRow> groups = new ArrayList<>();
        int totalSubmitted = 0, totalOverdue = 0, totalPending = 0;
        LocalDate today = LocalDate.now();

        for (Map.Entry<String, Map<Long, RegulatoryReturn>> entry : groupedReturns.entrySet()) {
            String groupName = entry.getKey();
            List<RenditionGridDto.ReturnRow> returnRows = new ArrayList<>();
            int gTotal = 0, gSubmitted = 0, gOverdue = 0;

            for (Map.Entry<Long, RegulatoryReturn> retEntry : entry.getValue().entrySet()) {
                Long returnId = retEntry.getKey();
                RegulatoryReturn rr = retEntry.getValue();
                Map<String, List<ReturnFilingInstance>> byMonth = gridData.getOrDefault(groupName, Map.of())
                    .getOrDefault(returnId, Map.of());

                List<RenditionGridDto.CellStatus> cells = new ArrayList<>();
                for (String month : months) {
                    List<ReturnFilingInstance> monthInstances = byMonth.getOrDefault(month, List.of());
                    if (monthInstances.isEmpty()) {
                        cells.add(RenditionGridDto.CellStatus.builder()
                            .period(month).status("N/A").build());
                        continue;
                    }
                    int submitted = 0, overdue = 0, inProgress = 0, late = 0;
                    LocalDate nextDue = null;
                    for (ReturnFilingInstance inst : monthInstances) {
                        boolean filed = inst.getStatus() == ReturnFilingStatus.SUBMITTED
                            || inst.getStatus() == ReturnFilingStatus.SUBMITTED_LATE;
                        if (filed) {
                            submitted++;
                            if (inst.getStatus() == ReturnFilingStatus.SUBMITTED_LATE) late++;
                        } else if (inst.getDueDate() != null && inst.getDueDate().isBefore(today)) {
                            overdue++;
                        } else {
                            totalPending++;
                            if (inst.getStatus() == ReturnFilingStatus.IN_PROGRESS) inProgress++;
                            if (inst.getDueDate() != null && (nextDue == null || inst.getDueDate().isBefore(nextDue))) {
                                nextDue = inst.getDueDate();
                            }
                        }
                    }
                    int count = monthInstances.size();
                    // Worst state wins: an overdue period anywhere in the month marks the cell.
                    String status = overdue > 0 ? "OVERDUE"
                        : submitted == count ? (late > 0 ? "SUBMITTED_LATE" : "SUBMITTED")
                        : inProgress > 0 ? "IN_PROGRESS" : "NOT_STARTED";
                    LocalDate shownDue = nextDue != null ? nextDue : monthInstances.get(monthInstances.size() - 1).getDueDate();
                    cells.add(RenditionGridDto.CellStatus.builder()
                        .period(month)
                        .status(status)
                        .dueDate(shownDue != null ? shownDue.toString() : null)
                        .count(count)
                        .submitted(submitted)
                        .overdue(overdue)
                        .build());
                    gTotal += count;
                    gSubmitted += submitted;
                    gOverdue += overdue;
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
                    .total(gTotal)
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
        Map<String, Integer> bands = config.getBandThresholds() != null
            ? config.getBandThresholds() : Map.of();

        List<ObligationClassification> all = obligations.findAll().stream()
            .filter(c -> "applicable".equals(c.getApplicability()))
            .toList();

        Set<String> seenImpacts = new LinkedHashSet<>();
        Set<String> seenLikelihoods = new LinkedHashSet<>();
        for (ObligationClassification oc : all) {
            String rating = "residual".equals(view) ? oc.getResidualRiskRating() : oc.getImpactRating();
            if (rating != null) seenImpacts.add(rating);
            if (oc.getLikelihoodRating() != null) seenLikelihoods.add(oc.getLikelihoodRating());
        }
        List<String> impacts = resolveAxis(config.getImpactLevels(), seenImpacts, DEFAULT_IMPACT_LEVELS);
        List<String> likelihoods = resolveAxis(config.getLikelihoodLevels(), seenLikelihoods, DEFAULT_LIKELIHOOD_LEVELS);

        Map<Long, Boolean> gapMap = all.stream()
            .filter(oc -> oc.getObligationId() != null)
            .collect(Collectors.toMap(ObligationClassification::getObligationId,
                oc -> hasNoControl(oc), (a, b) -> a));

        Map<String, Map<String, RiskHeatmapDto.HeatmapCell>> cellMap = new LinkedHashMap<>();
        for (String impact : impacts) {
            cellMap.put(impact, new LinkedHashMap<>());
            for (String likelihood : likelihoods) {
                int impactIdx = impacts.indexOf(impact) + 1;
                int likelihoodIdx = likelihoods.indexOf(likelihood) + 1;
                // Same band rule as the Risk Profile panel and the register (canonical matrix axes,
                // else the shared RiskBands toolkit scale) — not the cell's position in this grid.
                int score = axisLevel(impact, ObligationClassification.IMPACT_LEVELS, impactIdx)
                    * axisLevel(likelihood, ObligationClassification.LIKELIHOOD_LEVELS, likelihoodIdx);
                String band = ObligationClassification.inherentBand(impact, likelihood);
                if (band == null) band = resolveBand(impactIdx * likelihoodIdx, bands);
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

    /**
     * The configured axis when it covers every rating in use; otherwise the ratings in use ordered
     * by their 1..5 level (seeded data mixes the toolkit's Very Low..Very High with 3-level labels),
     * so the grid never grows extra columns past the top of the scale.
     */
    private List<String> resolveAxis(List<String> configured, Set<String> seen, List<String> fallback) {
        if (configured != null && !configured.isEmpty() && configured.containsAll(seen)) return new ArrayList<>(configured);
        if (seen.isEmpty()) return new ArrayList<>(fallback);
        List<String> axis = new ArrayList<>(seen);
        axis.sort(Comparator.comparingInt((String v) -> {
            int lvl = RiskBands.level(v);
            return lvl > 0 ? lvl : 9;
        }));
        return axis;
    }

    /** 1..5 level of a rating on the canonical axis, else the toolkit scale, else its grid position. */
    private static int axisLevel(String label, List<String> canonical, int position) {
        int idx = canonical.indexOf(label) + 1;
        if (idx > 0) return idx;
        int lvl = RiskBands.level(label);
        return lvl > 0 ? lvl : position;
    }

    private String resolveBand(int score, Map<String, Integer> bands) {
        int critical = bands.getOrDefault("critical", 18);
        int high = bands.getOrDefault("high", 12);
        int moderate = bands.getOrDefault("moderate", 6);
        if (score >= critical) return "Critical";
        if (score >= high) return "High";
        if (score >= moderate) return "Moderate";
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
        Map<Long, String> returnAreas = new HashMap<>();
        for (var link : obligationRepo.findAllReturnLinks()) {
            returnAreas.putIfAbsent(link.getReturnId(),
                aofMap.getOrDefault(link.getObligationId(), "Unassigned"));
        }

        List<EscalationMatrixDto.EscalationRow> rows = new ArrayList<>();
        int l1 = 0, l2 = 0, l3 = 0;

        for (ReturnFilingInstance inst : escalated) {
            RegulatoryReturn rr = returnMap.get(inst.getReturnId());
            if (rr == null) continue;

            Department dept = rr.getDepartmentId() != null ? deptMap.get(rr.getDepartmentId()) : null;
            String areaOfFocus = returnAreas.getOrDefault(inst.getReturnId(), "Unassigned");

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
                .daysLate(daysLate(inst, LocalDate.now()))
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

    /**
     * Days past due. {@code daysLate} is only stored when a return is submitted, so for an open
     * period it is computed from the due date (an escalated period due 3 days ago is 3 days late).
     */
    static int daysLate(ReturnFilingInstance inst, LocalDate today) {
        boolean filed = inst.getStatus() == ReturnFilingStatus.SUBMITTED
            || inst.getStatus() == ReturnFilingStatus.SUBMITTED_LATE;
        if (filed || inst.getDueDate() == null) {
            return inst.getDaysLate() != null ? inst.getDaysLate() : 0;
        }
        return (int) Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(inst.getDueDate(), today));
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

    public ControlCoverageDto getControlCoverageByAct() {
        List<ObligationClassification> all = obligations.findAll().stream()
            .filter(c -> "applicable".equals(c.getApplicability()))
            .toList();
        Map<Long, String> actMap = buildActMap();

        Map<String, ControlCoverageDto.CoverageRow> map = new LinkedHashMap<>();
        for (ObligationClassification oc : all) {
            String act = resolveAct(actMap, oc);
            ControlCoverageDto.CoverageRow row = map.computeIfAbsent(act, k ->
                ControlCoverageDto.CoverageRow.builder().name(k).build());
            row.setTotalObligations(row.getTotalObligations() + 1);
            if (hasNoControl(oc)) row.setGaps(row.getGaps() + 1);
            else row.setCovered(row.getCovered() + 1);
        }
        return buildCoverageResult("Act", map);
    }

    private ControlCoverageDto buildCoverageResult(String dimension, Map<String, ControlCoverageDto.CoverageRow> map) {
        Map<String, ThresholdDto.ThresholdRange> thresholdConfig = loadThresholds();
        List<ControlCoverageDto.CoverageRow> rows = new ArrayList<>(map.values());
        for (ControlCoverageDto.CoverageRow row : rows) {
            double pct = row.getTotalObligations() > 0
                ? (double) row.getCovered() / row.getTotalObligations() * 100 : 0;
            row.setCoveragePercentage(Math.round(pct * 10.0) / 10.0);
            row.setColor(resolveColor(thresholdConfig, pct, "control_coverage", 80, 60));
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
                .overallColor(resolveColor(thresholdConfig, overallPct, "control_coverage", 80, 60))
                .build())
            .build();
    }

    // ------------------------------------------------------------------ risk profile (legacy, kept for backward compat)

    /** Inherent band, else the tenant's rating, else "Unrated" — a missing rating is never shown as a real band. */
    static String profileRisk(ObligationClassification oc) {
        if (oc.getInherentRiskRating() != null && !oc.getInherentRiskRating().isBlank()) return oc.getInherentRiskRating();
        if (oc.getTenantRiskRating() != null && !oc.getTenantRiskRating().isBlank()) return oc.getTenantRiskRating();
        return RiskBands.UNRATED;
    }

    public RiskProfileDto getRiskProfile() {
        List<ObligationClassification> all = obligations.findAll().stream()
            .filter(c -> "applicable".equals(c.getApplicability()))
            .toList();
        Map<Long, String> aofMap = buildAreaOfFocusMap();
        Map<Long, String> actMap = buildActMap();

        Map<String, Integer> riskCounts = new LinkedHashMap<>();
        riskCounts.put("Critical", 0);
        riskCounts.put("High", 0);
        riskCounts.put("Moderate", 0);
        riskCounts.put("Low", 0);

        for (ObligationClassification oc : all) {
            riskCounts.merge(profileRisk(oc), 1, Integer::sum);
        }
        // an "Unrated" row only when there is something in it
        if (riskCounts.getOrDefault(RiskBands.UNRATED, 0) == 0) riskCounts.remove(RiskBands.UNRATED);

        int total = all.size();
        List<RiskProfileDto.RiskRow> riskRows = riskCounts.entrySet().stream()
            .map(e -> RiskProfileDto.RiskRow.builder()
                .level(e.getKey())
                .count(e.getValue())
                .percentage(total > 0 ? Math.round((double) e.getValue() / total * 1000.0) / 10.0 : 0)
                .build())
            .toList();

        Map<String, RiskProfileDto.AreaRow> areaMap = new LinkedHashMap<>();
        Map<String, RiskProfileDto.ActRow> actRowMap = new LinkedHashMap<>();
        for (ObligationClassification oc : all) {
            String area = resolveArea(aofMap, oc);
            RiskProfileDto.AreaRow row = areaMap.computeIfAbsent(area, k ->
                RiskProfileDto.AreaRow.builder().areaOfFocus(k).build());
            RiskProfileDto.ActRow actRow = actRowMap.computeIfAbsent(resolveAct(actMap, oc), k ->
                RiskProfileDto.ActRow.builder().actName(k).build());
            row.setTotal(row.getTotal() + 1);
            actRow.setTotal(actRow.getTotal() + 1);
            switch (profileRisk(oc)) {
                case "Critical" -> { row.setExtreme(row.getExtreme() + 1); actRow.setExtreme(actRow.getExtreme() + 1); }
                case "High" -> { row.setHigh(row.getHigh() + 1); actRow.setHigh(actRow.getHigh() + 1); }
                case "Moderate", "Medium" -> { row.setMedium(row.getMedium() + 1); actRow.setMedium(actRow.getMedium() + 1); }
                case "Low" -> { row.setLow(row.getLow() + 1); actRow.setLow(actRow.getLow() + 1); }
                default -> { row.setUnrated(row.getUnrated() + 1); actRow.setUnrated(actRow.getUnrated() + 1); }
            }
            if (hasNoControl(oc)) {
                row.setGaps(row.getGaps() + 1);
                actRow.setGaps(actRow.getGaps() + 1);
            }
        }

        int gapsCount = (int) all.stream().filter(this::hasNoControl).count();

        return RiskProfileDto.builder()
            .riskLevels(riskRows)
            .byAreaOfFocus(new ArrayList<>(areaMap.values()))
            .byAct(new ArrayList<>(actRowMap.values()))
            .summary(RiskProfileDto.Summary.builder()
                .totalApplicable(total)
                .extremeCount(riskCounts.getOrDefault("Critical", 0))
                .highCount(riskCounts.getOrDefault("High", 0))
                .mediumCount(riskCounts.getOrDefault("Moderate", 0))
                .lowCount(riskCounts.getOrDefault("Low", 0))
                .unratedCount(riskCounts.getOrDefault(RiskBands.UNRATED, 0))
                .actCount((int) actRowMap.keySet().stream().filter(a -> !AreasOfFocus.UNASSIGNED.equals(a)).count())
                .gapsCount(gapsCount)
                .build())
            .build();
    }

    // ------------------------------------------------------------------ thresholds

    public ThresholdDto getThresholds() {
        Map<String, ThresholdDto.ThresholdRange> map = loadThresholds();
        if (map.isEmpty()) return ThresholdDto.defaults();
        return ThresholdDto.builder().thresholds(map).build();
    }

    private Map<String, ThresholdDto.ThresholdRange> loadThresholds() {
        Map<String, ThresholdDto.ThresholdRange> map = new LinkedHashMap<>();
        for (DashboardThreshold t : thresholds.findByTenantId(tenantIdentity.currentTenantId())) {
            map.put(t.getMetricName(), new ThresholdDto.ThresholdRange(t.getGreenMin(), t.getAmberMin()));
        }
        return map;
    }

    @Transactional
    public void saveThresholds(ThresholdDto dto) {
        Long tenantId = tenantIdentity.currentTenantId();
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

    private String resolveDepartmentName(Map<Integer, String> deptNames, Integer departmentId) {
        if (departmentId == null) return "Unassigned";
        return deptNames.getOrDefault(departmentId, "Unassigned");
    }

    /** The grid column ("yyyy-MM") an instance belongs to: its due date's month, else a monthly period label. */
    static String monthKey(ReturnFilingInstance inst) {
        if (inst.getDueDate() != null) return YearMonth.from(inst.getDueDate()).toString();
        String period = inst.getPeriod();
        return period != null && period.matches("\\d{4}-\\d{2}") ? period : null;
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

    private String resolveColor(Map<String, ThresholdDto.ThresholdRange> config, double pct, String metric,
                                double defaultGreen, double defaultAmber) {
        ThresholdDto.ThresholdRange range = config != null ? config.get(metric) : null;
        double green = range != null ? range.getGreen() : defaultGreen;
        double amber = range != null ? range.getAmber() : defaultAmber;
        if (pct >= green) return "green";
        if (pct >= amber) return "amber";
        return "red";
    }
}
