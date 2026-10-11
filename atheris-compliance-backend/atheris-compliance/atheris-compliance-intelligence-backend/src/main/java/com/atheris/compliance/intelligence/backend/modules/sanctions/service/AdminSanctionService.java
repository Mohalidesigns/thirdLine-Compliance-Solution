package com.atheris.compliance.intelligence.backend.modules.sanctions.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.sanctions.dto.AdminSanctionDto;
import com.atheris.compliance.intelligence.backend.modules.sanctions.entity.SanctionsPenalty;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
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
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class AdminSanctionService {

    private final SanctionsRepository sanctions;
    private final RegulationRepository regulations;
    private final InstrumentRepository instruments;

    public Page<AdminSanctionDto> list(String q, Long regulationId, String penaltyType, String liableRole,
                                       BigDecimal minAmount, BigDecimal maxAmount,
                                       Boolean hasBeenEnforced, Integer minSeverity, Pageable pageable) {
        Specification<SanctionsPenalty> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            // Free-text search targets the OBLIGATION (the offence/violation) only.
            if (q != null && !q.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("description")), "%" + q.toLowerCase() + "%"));
            }
            if (regulationId != null) predicates.add(cb.equal(root.get("regulationId"), regulationId));
            if (penaltyType != null && !penaltyType.isBlank()) {
                // penalty_type is a JSONB array — match when it contains the requested kind.
                predicates.add(cb.isTrue(cb.function("jsonb_exists",
                    Boolean.class, root.get("penaltyType"), cb.literal(penaltyType))));
            }
            if (liableRole != null && !liableRole.isBlank()) {
                predicates.add(cb.isTrue(cb.function("jsonb_exists",
                    Boolean.class, root.get("liableRoles"), cb.literal(liableRole))));
            }
            if (minAmount != null) predicates.add(cb.greaterThanOrEqualTo(root.get("sanctionAmountNaira"), minAmount));
            if (maxAmount != null) predicates.add(cb.lessThanOrEqualTo(root.get("sanctionAmountNaira"), maxAmount));
            if (hasBeenEnforced != null) predicates.add(cb.equal(root.get("hasBeenEnforced"), hasBeenEnforced));
            if (minSeverity != null) predicates.add(cb.greaterThanOrEqualTo(root.get("severityScore"), minSeverity));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<SanctionsPenalty> page = sanctions.findAll(spec, withNullsLast(pageable));
        List<SanctionsPenalty> rows = page.getContent();
        Map<Long, Regulation> acts = resolveActs(rows);
        Map<Long, String> instrumentTitles = resolveInstrumentTitles(rows);
        return page.map(s -> toDto(s, acts.get(s.getRegulationId()),
            s.getInstrumentId() == null ? null : instrumentTitles.get(s.getInstrumentId())));
    }

    public AdminSanctionDto detail(Long id) {
        SanctionsPenalty s = sanctions.findById(id)
            .orElseThrow(() -> new RuntimeException("Sanction not found: " + id));
        Regulation act = s.getRegulationId() != null
            ? regulations.findById(s.getRegulationId()).orElse(null)
            : null;
        String instrumentTitle = s.getInstrumentId() != null
            ? instruments.findById(s.getInstrumentId()).map(Instrument::getSourceTitle).orElse(null)
            : null;
        return toDto(s, act, instrumentTitle);
    }

    public Map<String, Object> stats() {
        // Single pass over the (small) sanction set: penalty_type / liable_roles are JSONB arrays
        // whose elements cannot be expanded in a JPA Criteria group-by, so the facet counts are
        // derived in memory. Act names are resolved with one batched findAllById (no N+1).
        List<SanctionsPenalty> all = sanctions.findAll();

        long enforced = 0;
        long highSeverity = 0;
        BigDecimal totalExposure = BigDecimal.ZERO;
        Map<String, Long> byPenaltyType = new TreeMap<>();
        Map<String, Long> enforcedByPenaltyType = new TreeMap<>();
        Map<Long, BigDecimal> exposureByAct = new LinkedHashMap<>();
        java.util.Set<String> roleSet = new java.util.TreeSet<>();

        for (SanctionsPenalty s : all) {
            boolean isEnforced = Boolean.TRUE.equals(s.getHasBeenEnforced());
            if (isEnforced) enforced++;
            if (s.getSeverityScore() != null && s.getSeverityScore() > 7) highSeverity++;
            if (s.getSanctionAmountNaira() != null) {
                totalExposure = totalExposure.add(s.getSanctionAmountNaira());
                if (s.getRegulationId() != null) {
                    exposureByAct.merge(s.getRegulationId(), s.getSanctionAmountNaira(), BigDecimal::add);
                }
            }
            for (String kind : safeList(s.getPenaltyType())) {
                byPenaltyType.merge(kind, 1L, Long::sum);
                if (isEnforced) enforcedByPenaltyType.merge(kind, 1L, Long::sum);
            }
            roleSet.addAll(safeList(s.getLiableRoles()));
        }

        Set<Long> actIds = all.stream().map(SanctionsPenalty::getRegulationId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, Regulation> actById = actIds.isEmpty() ? Map.of()
            : regulations.findAllById(actIds).stream()
                .filter(a -> a.getName() != null)
                .collect(Collectors.toMap(Regulation::getRegulationId, Function.identity(), (a, b) -> a));

        List<Map<String, Object>> acts = actById.values().stream()
            .sorted(Comparator.comparing(Regulation::getName, String.CASE_INSENSITIVE_ORDER))
            .map(a -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("actId", a.getRegulationId());
                m.put("name", a.getName());
                return m;
            }).toList();

        List<Map<String, Object>> byActExposure = exposureByAct.entrySet().stream()
            .sorted(Map.Entry.<Long, BigDecimal>comparingByValue().reversed())
            .map(e -> {
                Regulation a = actById.get(e.getKey());
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("actId", e.getKey());
                m.put("name", a != null ? a.getName() : null);
                m.put("amount", e.getValue());
                return m;
            }).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", (long) all.size());
        out.put("enforced", enforced);
        out.put("notEnforced", all.size() - enforced);
        out.put("highSeverity", highSeverity);
        out.put("totalExposure", totalExposure);
        out.put("penaltyTypes", List.copyOf(byPenaltyType.keySet()));
        out.put("byPenaltyType", byPenaltyType);
        out.put("enforcedByPenaltyType", enforcedByPenaltyType);
        out.put("liableRoles", List.copyOf(roleSet));
        out.put("acts", acts);
        out.put("byActExposure", byActExposure);
        return out;
    }

    private static List<String> safeList(List<String> v) {
        return v == null ? List.of() : v;
    }

    /**
     * Sort nullable columns NULLS LAST so sparse instrument-level sanctions (null severity/amount)
     * do not fill the first page ahead of the data-rich grid rows. Postgres defaults NULLs FIRST
     * for DESC. A stable sanctionId tiebreaker keeps pagination deterministic.
     */
    private static Pageable withNullsLast(Pageable pageable) {
        boolean hasSanctionId = pageable.getSort().stream()
            .anyMatch(o -> "sanctionId".equals(o.getProperty()));
        List<Sort.Order> orders = new ArrayList<>();
        for (Sort.Order o : pageable.getSort()) {
            boolean nullable = "severityScore".equals(o.getProperty())
                || "sanctionAmountNaira".equals(o.getProperty());
            orders.add(nullable ? o.nullsLast() : o);
        }
        if (!hasSanctionId) orders.add(Sort.Order.desc("sanctionId"));
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(orders));
    }

    private Map<Long, Regulation> resolveActs(List<SanctionsPenalty> rows) {
        Set<Long> ids = rows.stream().map(SanctionsPenalty::getRegulationId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return regulations.findAllById(ids).stream()
            .collect(Collectors.toMap(Regulation::getRegulationId, Function.identity(), (a, b) -> a));
    }

    private Map<Long, String> resolveInstrumentTitles(List<SanctionsPenalty> rows) {
        Set<Long> ids = rows.stream().map(SanctionsPenalty::getInstrumentId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return instruments.findAllById(ids).stream()
            .filter(i -> i.getSourceTitle() != null)
            .collect(Collectors.toMap(Instrument::getInstrumentId, Instrument::getSourceTitle, (a, b) -> a));
    }

    private AdminSanctionDto toDto(SanctionsPenalty s, Regulation act, String instrumentTitle) {
        return AdminSanctionDto.builder()
            .sanctionId(s.getSanctionId())
            .sanctionType(s.getSanctionType())
            .sanctionAmountNaira(s.getSanctionAmountNaira())
            .sanctionAmountPerDay(s.getSanctionAmountPerDay())
            .liableRoles(s.getLiableRoles())
            .penaltyType(s.getPenaltyType())
            .severityScore(s.getSeverityScore())
            .hasBeenEnforced(s.getHasBeenEnforced())
            .sourceSectionReference(s.getSourceSectionReference())
            .regulationId(s.getRegulationId())
            .actName(act != null ? act.getName() : null)
            .actAbbreviation(act != null ? act.getAbbreviation() : null)
            .instrumentId(s.getInstrumentId())
            .instrumentTitle(instrumentTitle)
            .description(s.getDescription())
            .riskExplanation(s.getRiskExplanation())
            .penaltyDetails(s.getPenaltyDetails())
            .personalLiabilityNaira(s.getPersonalLiabilityNaira())
            .recentEnforcementDate(s.getRecentEnforcementDate())
            .recentEnforcementAmount(s.getRecentEnforcementAmount())
            .createdAt(s.getCreatedAt())
            .updatedAt(s.getUpdatedAt())
            .build();
    }
}