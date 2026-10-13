package com.atheris.compliance.tenant.backend.modules.sanctions.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.RegulatorySanction;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.sanctions.dto.SanctionListItem;
import com.atheris.compliance.tenant.backend.modules.sanctions.dto.SanctionStatsDto;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * Sanctions register: filtering, sorting and stats. The controller is thin.
 * Filtering/sorting run in the database (JPA Criteria) instead of loading every row.
 */
@Service
@RequiredArgsConstructor
public class SanctionService {

    private final RegulatorySanctionRepository repo;

    public Page<SanctionListItem> list(String q, String sanctionType, String actName, Boolean enforced,
                                       Long regulationId, String penaltyType, String liableRole,
                                       BigDecimal minAmount, BigDecimal maxAmount, Boolean hasBeenEnforced,
                                       Integer minSeverity, Pageable pageable) {
        Specification<RegulatorySanction> spec = buildSpec(q, sanctionType, actName, enforced, regulationId,
            penaltyType, liableRole, minAmount, maxAmount, hasBeenEnforced, minSeverity);
        Pageable effective = applySort(pageable);
        return repo.findAll(spec, effective).map(this::toListItem);
    }

    public SanctionStatsDto stats() {
        List<RegulatorySanction> all = repo.findAll();
        long enforced = all.stream().filter(s -> Boolean.TRUE.equals(s.getHasBeenEnforced())).count();
        long highSeverity = all.stream().filter(s -> s.getSeverityScore() != null && s.getSeverityScore() >= 8).count();

        List<String> penaltyTypeOptions = all.stream().flatMap(s -> penaltyTypeOf(s).stream())
            .distinct().sorted().toList();

        List<String> acts = all.stream().map(RegulatorySanction::getRegulationName)
            .filter(r -> r != null && !r.isBlank()).distinct().sorted().toList();

        Map<String, Long> byPenaltyType = new TreeMap<>();
        Map<String, Long> enforcedByPenaltyType = new TreeMap<>();
        for (RegulatorySanction s : all) {
            for (String t : penaltyTypeOf(s)) {
                byPenaltyType.merge(t, 1L, Long::sum);
                if (Boolean.TRUE.equals(s.getHasBeenEnforced())) enforcedByPenaltyType.merge(t, 1L, Long::sum);
            }
        }

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
            .sorted(Comparator.comparing(SanctionStatsDto.ActExposure::getAmount,
                Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();

        List<SanctionStatsDto.ActOption> actOptions = all.stream()
            .filter(s -> s.getRegulationId() != null)
            .collect(java.util.stream.Collectors.toMap(RegulatorySanction::getRegulationId,
                s -> SanctionStatsDto.ActOption.builder().actId(s.getRegulationId()).name(s.getRegulationName()).build(),
                (a, b) -> a, TreeMap::new))
            .values().stream().toList();

        return SanctionStatsDto.builder()
            .total(all.size()).enforced(enforced).highSeverity(highSeverity)
            .totalExposure(repo.sumExposure())
            .sanctionTypes(penaltyTypeOptions).actNames(acts)
            .byPenaltyType(byPenaltyType).byActExposure(byActExposure)
            .enforcedByPenaltyType(enforcedByPenaltyType)
            .penaltyTypes(penaltyTypeOptions).liableRoles(liableRoles).acts(actOptions)
            .build();
    }

    // ---------------------------------------------------------------- helpers

    private List<String> penaltyTypeOf(RegulatorySanction s) {
        if (s.getPenaltyType() != null && !s.getPenaltyType().isEmpty()) return s.getPenaltyType();
        return s.getSanctionType() != null && !s.getSanctionType().isBlank()
            ? List.of(s.getSanctionType()) : List.of();
    }

    private Specification<RegulatorySanction> buildSpec(String q, String sanctionType, String actName, Boolean enforced,
                                                        Long regulationId, String penaltyType, String liableRole,
                                                        BigDecimal minAmount, BigDecimal maxAmount,
                                                        Boolean hasBeenEnforced, Integer minSeverity) {
        return (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase() + "%";
                ps.add(cb.or(
                    cb.like(cb.lower(root.get("description")), like),
                    cb.like(cb.lower(root.get("regulationName")), like),
                    cb.like(cb.lower(root.get("sanctionType")), like)));
            }
            if (sanctionType != null && !sanctionType.isBlank())
                ps.add(cb.equal(cb.lower(root.get("sanctionType")), sanctionType.toLowerCase()));
            if (actName != null && !actName.isBlank())
                ps.add(cb.like(cb.lower(root.get("regulationName")), "%" + actName.toLowerCase() + "%"));
            if (enforced != null) ps.add(cb.equal(root.get("hasBeenEnforced"), enforced));
            if (regulationId != null) ps.add(cb.equal(root.get("regulationId"), regulationId));
            if (penaltyType != null && !penaltyType.isBlank())
                ps.add(cb.isTrue(cb.function("jsonb_exists", Boolean.class, root.get("penaltyType"), cb.literal(penaltyType))));
            if (liableRole != null && !liableRole.isBlank())
                ps.add(cb.isTrue(cb.function("jsonb_exists", Boolean.class, root.get("liableRoles"), cb.literal(liableRole))));
            if (minAmount != null) ps.add(cb.greaterThanOrEqualTo(root.get("sanctionAmountNaira"), minAmount));
            if (maxAmount != null) ps.add(cb.lessThanOrEqualTo(root.get("sanctionAmountNaira"), maxAmount));
            if (hasBeenEnforced != null) ps.add(cb.equal(root.get("hasBeenEnforced"), hasBeenEnforced));
            if (minSeverity != null) ps.add(cb.greaterThanOrEqualTo(root.get("severityScore"), minSeverity));
            return cb.and(ps.toArray(new Predicate[0]));
        };
    }

    /** Whitelist the sortable properties; unknown keys fall back to description. Sorted in the DB. */
    private Pageable applySort(Pageable pageable) {
        String prop = "sanctionAmountNaira";
        boolean asc = false;
        if (pageable.getSort().isSorted()) {
            Sort.Order o = pageable.getSort().iterator().next();
            prop = sortProperty(o.getProperty());
            asc = o.isAscending();
        }
        Sort sort = Sort.by(asc ? Sort.Direction.ASC : Sort.Direction.DESC, prop)
            .and(Sort.by(Sort.Direction.ASC, "sanctionId"));
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
    }

    private String sortProperty(String requested) {
        if (requested == null) return "sanctionAmountNaira";
        return switch (requested) {
            case "sanctionAmountNaira", "penaltyDetails", "severityScore", "sanctionType",
                 "description", "actName", "regulationName", "createdAt", "updatedAt" -> requested;
            // penaltyType is JSONB (not directly sortable); fall back to the flat sanctionType.
            case "penaltyType" -> "sanctionType";
            default -> "description";
        };
    }

    private SanctionListItem toListItem(RegulatorySanction s) {
        return SanctionListItem.builder()
            .sanctionId(s.getSanctionId()).instrumentId(s.getInstrumentId())
            .actId(s.getRegulationId()).actName(s.getRegulationName())
            .actAbbreviation(s.getActAbbreviation())
            .sanctionType(s.getSanctionType())
            .penaltyType(penaltyTypeOf(s))
            .sanctionAmountNaira(s.getSanctionAmountNaira())
            .sanctionAmountPerDay(s.getSanctionAmountPerDay())
            .personalLiabilityNaira(s.getPersonalLiabilityNaira())
            .liableRoles(s.getLiableRoles())
            .severityScore(s.getSeverityScore()).hasBeenEnforced(s.getHasBeenEnforced())
            .recentEnforcementDate(s.getRecentEnforcementDate())
            .recentEnforcementAmount(s.getRecentEnforcementAmount())
            .description(s.getDescription()).sourceSectionReference(s.getSourceSectionReference())
            .riskExplanation(s.getRiskExplanation()).penaltyDetails(s.getPenaltyDetails())
            .instrumentTitle(s.getInstrumentTitle())
            .createdAt(s.getCreatedAt()).updatedAt(s.getUpdatedAt())
            .build();
    }
}