package com.atheris.compliance.intelligence.backend.modules.sanctions.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.sanctions.dto.AdminSanctionDetailDto;
import com.atheris.compliance.intelligence.backend.modules.sanctions.dto.AdminSanctionDto;
import com.atheris.compliance.intelligence.backend.modules.sanctions.entity.SanctionsPenalty;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class AdminSanctionService {

    private final SanctionsRepository sanctions;
    private final RegulationRepository regulations;
    private final InstrumentRepository instruments;

    public Page<AdminSanctionDto> list(String q, Long regulationId, String sanctionType,
                                       Boolean hasBeenEnforced, Integer minSeverity, Pageable pageable) {
        Specification<SanctionsPenalty> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("description")), like),
                    cb.like(cb.lower(root.get("penaltyDetails")), like),
                    cb.like(cb.lower(root.get("sanctionType")), like)));
            }
            if (regulationId != null) predicates.add(cb.equal(root.get("regulationId"), regulationId));
            if (sanctionType != null && !sanctionType.isBlank())
                predicates.add(cb.equal(root.get("sanctionType"), sanctionType));
            if (hasBeenEnforced != null) predicates.add(cb.equal(root.get("hasBeenEnforced"), hasBeenEnforced));
            if (minSeverity != null) predicates.add(cb.greaterThanOrEqualTo(root.get("severityScore"), minSeverity));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<SanctionsPenalty> page = sanctions.findAll(spec, pageable);
        Map<Long, String> actNames = actNamesFor(page.getContent());
        return page.map(s -> toDto(s, actNames.get(s.getRegulationId())));
    }

    public AdminSanctionDetailDto detail(Long id) {
        SanctionsPenalty s = sanctions.findById(id)
            .orElseThrow(() -> new RuntimeException("Sanction not found: " + id));
        Regulation act = s.getRegulationId() != null
            ? regulations.findById(s.getRegulationId()).orElse(null)
            : null;
        String instrumentTitle = s.getInstrumentId() != null
            ? instruments.findById(s.getInstrumentId()).map(i -> i.getSourceTitle()).orElse(null)
            : null;
        return AdminSanctionDetailDto.builder()
            .sanctionId(s.getSanctionId())
            .sanctionType(s.getSanctionType())
            .sanctionAmountNaira(s.getSanctionAmountNaira())
            .sanctionAmountPerDay(s.getSanctionAmountPerDay())
            .liableRoles(s.getLiableRoles())
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

    public Map<String, Object> stats() {
        List<SanctionsPenalty> all = sanctions.findAll();

        Map<String, Long> byType = new TreeMap<>();
        long enforced = 0;
        long highSeverity = 0;
        BigDecimal totalExposure = BigDecimal.ZERO;
        for (SanctionsPenalty s : all) {
            String type = s.getSanctionType() != null ? s.getSanctionType() : "Unspecified";
            byType.merge(type, 1L, Long::sum);
            if (Boolean.TRUE.equals(s.getHasBeenEnforced())) enforced++;
            if (s.getSeverityScore() != null && s.getSeverityScore() > 7) highSeverity++;
            if (s.getSanctionAmountNaira() != null) totalExposure = totalExposure.add(s.getSanctionAmountNaira());
        }

        List<String> actNames = actNamesFor(all).values().stream().sorted().toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", (long) all.size());
        out.put("byType", byType);
        out.put("sanctionTypes", List.copyOf(byType.keySet()));
        out.put("enforced", enforced);
        out.put("notEnforced", all.size() - enforced);
        out.put("highSeverity", highSeverity);
        out.put("totalExposure", totalExposure);
        out.put("actNames", actNames);
        return out;
    }

    private Map<Long, String> actNamesFor(List<SanctionsPenalty> rows) {
        Set<Long> ids = rows.stream()
            .map(SanctionsPenalty::getRegulationId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return regulations.findAllById(ids).stream()
            .filter(r -> r.getName() != null)
            .collect(Collectors.toMap(Regulation::getRegulationId, Regulation::getName, (a, b) -> a));
    }

    private AdminSanctionDto toDto(SanctionsPenalty s, String actName) {
        return AdminSanctionDto.builder()
            .sanctionId(s.getSanctionId())
            .sanctionType(s.getSanctionType())
            .sanctionAmountNaira(s.getSanctionAmountNaira())
            .sanctionAmountPerDay(s.getSanctionAmountPerDay())
            .liableRoles(s.getLiableRoles())
            .severityScore(s.getSeverityScore())
            .hasBeenEnforced(s.getHasBeenEnforced())
            .sourceSectionReference(s.getSourceSectionReference())
            .regulationId(s.getRegulationId())
            .actName(actName)
            .instrumentId(s.getInstrumentId())
            .build();
    }
}
