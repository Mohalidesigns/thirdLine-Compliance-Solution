package com.atheris.compliance.tenant.backend.modules.sanctions.controller;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.RegulatorySanction;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.sanctions.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/sanctions")
@RequiredArgsConstructor
public class SanctionsController {

    private final RegulatorySanctionRepository repo;

    @GetMapping
    public ResponseEntity<Page<SanctionListItem>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String sanctionType,
            @RequestParam(required = false) String actName,
            @RequestParam(required = false) Boolean enforced,
            @RequestParam(required = false) Long regulationId,
            @RequestParam(required = false) String penaltyType,
            @RequestParam(required = false) String liableRole,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount,
            @RequestParam(required = false) Boolean hasBeenEnforced,
            @RequestParam(required = false) Integer minSeverity,
            Pageable p) {
        List<SanctionListItem> items = repo.findAll().stream()
            .map(this::toListItem)
            .filter(i -> matches(i, q, sanctionType, actName, enforced, regulationId, penaltyType,
                liableRole, minAmount, maxAmount, hasBeenEnforced, minSeverity))
            .sorted(listComparator(p))
            .toList();

        int start = (int) p.getOffset();
        int end = Math.min(start + p.getPageSize(), items.size());
        List<SanctionListItem> sub = start > items.size() ? List.of() : items.subList(start, end);
        return ResponseEntity.ok(new PageImpl<>(sub, p, items.size()));
    }

    @GetMapping("/stats")
    public ResponseEntity<SanctionStatsDto> stats() {
        List<RegulatorySanction> all = repo.findAll();
        long enforced = all.stream().filter(s -> Boolean.TRUE.equals(s.getHasBeenEnforced())).count();
        long highSeverity = all.stream().filter(s -> s.getSeverityScore() != null && s.getSeverityScore() >= 8).count();
        List<String> types = all.stream().map(RegulatorySanction::getSanctionType)
            .filter(t -> t != null && !t.isBlank()).distinct().sorted().toList();
        List<String> acts = all.stream().map(RegulatorySanction::getRegulationName)
            .filter(r -> r != null && !r.isBlank()).distinct().sorted().toList();

        Map<String, Long> byPenaltyType = all.stream()
            .map(RegulatorySanction::getSanctionType).filter(t -> t != null && !t.isBlank())
            .collect(Collectors.groupingBy(t -> t, TreeMap::new, Collectors.counting()));
        Map<String, Long> enforcedByPenaltyType = all.stream()
            .filter(s -> Boolean.TRUE.equals(s.getHasBeenEnforced()))
            .map(RegulatorySanction::getSanctionType).filter(t -> t != null && !t.isBlank())
            .collect(Collectors.groupingBy(t -> t, TreeMap::new, Collectors.counting()));
        List<String> liableRoles = all.stream()
            .map(RegulatorySanction::getLiableRoles).filter(Objects::nonNull)
            .flatMap(List::stream).filter(v -> v != null && !v.isBlank())
            .distinct().sorted().toList();

        Map<Long, SanctionStatsDto.ActExposure> exposureByAct = new LinkedHashMap<>();
        for (RegulatorySanction s : all) {
            if (s.getRegulationId() == null) continue;
            BigDecimal amount = s.getSanctionAmountNaira() != null ? s.getSanctionAmountNaira() : BigDecimal.ZERO;
            exposureByAct.merge(s.getRegulationId(),
                SanctionStatsDto.ActExposure.builder()
                    .actId(s.getRegulationId()).name(s.getRegulationName()).amount(amount).build(),
                (a, b) -> { a.setAmount(a.getAmount().add(b.getAmount())); return a; });
        }
        List<SanctionStatsDto.ActExposure> byActExposure = exposureByAct.values().stream()
            .sorted(Comparator.comparing(SanctionStatsDto.ActExposure::getAmount, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
        List<SanctionStatsDto.ActOption> actOptions = all.stream()
            .filter(s -> s.getRegulationId() != null)
            .collect(Collectors.toMap(RegulatorySanction::getRegulationId,
                s -> SanctionStatsDto.ActOption.builder().actId(s.getRegulationId()).name(s.getRegulationName()).build(),
                (a, b) -> a, TreeMap::new))
            .values().stream().toList();

        return ResponseEntity.ok(SanctionStatsDto.builder()
            .total(all.size()).enforced(enforced).highSeverity(highSeverity)
            .totalExposure(repo.sumExposure())
            .sanctionTypes(types).actNames(acts)
            .byPenaltyType(byPenaltyType).byActExposure(byActExposure)
            .enforcedByPenaltyType(enforcedByPenaltyType)
            .penaltyTypes(types).liableRoles(liableRoles).acts(actOptions)
            .build());
    }

    private boolean matches(SanctionListItem i, String q, String sanctionType, String actName, Boolean enforced,
                            Long regulationId, String penaltyType, String liableRole, BigDecimal minAmount,
                            BigDecimal maxAmount, Boolean hasBeenEnforced, Integer minSeverity) {
        if (q != null && !q.isBlank()) {
            String ql = q.toLowerCase();
            boolean hit = (i.getDescription() != null && i.getDescription().toLowerCase().contains(ql))
                || (i.getActName() != null && i.getActName().toLowerCase().contains(ql))
                || (i.getSanctionType() != null && i.getSanctionType().toLowerCase().contains(ql));
            if (!hit) return false;
        }
        if (sanctionType != null && !sanctionType.isBlank() && !sanctionType.equalsIgnoreCase(i.getSanctionType())) return false;
        if (actName != null && !actName.isBlank()
                && (i.getActName() == null || !i.getActName().toLowerCase().contains(actName.toLowerCase()))) return false;
        if (enforced != null && !enforced.equals(i.getHasBeenEnforced())) return false;
        if (regulationId != null && !regulationId.equals(i.getActId())) return false;
        if (penaltyType != null && !penaltyType.isBlank() && !penaltyType.equalsIgnoreCase(i.getSanctionType())) return false;
        if (liableRole != null && !liableRole.isBlank()
                && (i.getLiableRoles() == null || i.getLiableRoles().stream().noneMatch(r -> r.equalsIgnoreCase(liableRole)))) return false;
        if (minAmount != null && (i.getSanctionAmountNaira() == null || i.getSanctionAmountNaira().compareTo(minAmount) < 0)) return false;
        if (maxAmount != null && (i.getSanctionAmountNaira() == null || i.getSanctionAmountNaira().compareTo(maxAmount) > 0)) return false;
        if (hasBeenEnforced != null && !hasBeenEnforced.equals(i.getHasBeenEnforced())) return false;
        if (minSeverity != null && (i.getSeverityScore() == null || i.getSeverityScore() < minSeverity)) return false;
        return true;
    }

    private Comparator<SanctionListItem> listComparator(Pageable p) {
        if (!p.getSort().isSorted()) {
            return Comparator.comparing(SanctionListItem::getSeverityScore, Comparator.nullsLast(Comparator.reverseOrder()));
        }
        Sort.Order o = p.getSort().iterator().next();
        Comparator<SanctionListItem> cmp = switch (o.getProperty()) {
            case "sanctionAmountNaira" -> Comparator.comparing(SanctionListItem::getSanctionAmountNaira,
                Comparator.nullsLast(Comparator.naturalOrder()));
            case "severityScore" -> Comparator.comparing(SanctionListItem::getSeverityScore,
                Comparator.nullsLast(Comparator.naturalOrder()));
            case "penaltyType", "sanctionType" -> Comparator.comparing(i -> nullSafe(i.getSanctionType()));
            case "penaltyDetails" -> Comparator.comparing(i -> nullSafe(i.getPenaltyDetails()));
            case "liableRoles", "liableRole" -> Comparator.comparing(i -> i.getLiableRoles() == null ? "" : String.join(",", i.getLiableRoles()));
            default -> Comparator.comparing(i -> nullSafe(i.getDescription()));
        };
        return o.isAscending() ? cmp : cmp.reversed();
    }

    private static String nullSafe(String s) { return s != null ? s : ""; }

    private SanctionListItem toListItem(RegulatorySanction s) {
        return SanctionListItem.builder()
            .sanctionId(s.getSanctionId()).instrumentId(s.getInstrumentId())
            .actId(s.getRegulationId()).actName(s.getRegulationName())
            .sanctionType(s.getSanctionType())
            .penaltyType(s.getSanctionType() != null && !s.getSanctionType().isBlank()
                ? List.of(s.getSanctionType()) : List.of())
            .sanctionAmountNaira(s.getSanctionAmountNaira())
            .sanctionAmountPerDay(s.getSanctionAmountPerDay()).liableRoles(s.getLiableRoles())
            .severityScore(s.getSeverityScore()).hasBeenEnforced(s.getHasBeenEnforced())
            .description(s.getDescription()).sourceSectionReference(s.getSourceSectionReference())
            .riskExplanation(s.getRiskExplanation()).penaltyDetails(s.getPenaltyDetails())
            .build();
    }
}
