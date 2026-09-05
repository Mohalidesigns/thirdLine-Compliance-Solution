package com.atheris.compliance.intelligence.backend.modules.obligations.service;

import com.atheris.compliance.intelligence.backend.modules.obligations.dto.AdminObligationDetailDto;
import com.atheris.compliance.intelligence.backend.modules.obligations.dto.AdminObligationDto;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class AdminObligationService {

    private final ObligationMappingRepository obligations;
    private final RegulationRepository regulations;

    public Page<AdminObligationDto> list(String q, Long regulationId, String areaOfFocus,
                                         String inherentRiskRating, String obligationType, Pageable pageable) {
        Specification<ObligationMapping> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("title")), like),
                    cb.like(cb.lower(root.get("plainEnglishStatement")), like),
                    cb.like(cb.lower(root.get("description")), like)
                ));
            }
            if (regulationId != null) predicates.add(cb.equal(root.get("regulationId"), regulationId));
            if (areaOfFocus != null && !areaOfFocus.isBlank()) predicates.add(cb.equal(root.get("areaOfFocus"), areaOfFocus));
            if (inherentRiskRating != null && !inherentRiskRating.isBlank()) predicates.add(cb.equal(root.get("inherentRiskRating"), inherentRiskRating));
            if (obligationType != null && !obligationType.isBlank()) predicates.add(cb.equal(root.get("obligationType"), obligationType));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ObligationMapping> page = obligations.findAll(spec, pageable);
        Map<Long, String> actNames = resolveActNames(page.getContent());
        List<AdminObligationDto> rows = page.getContent().stream()
            .map(o -> toDto(o, actNames.get(o.getRegulationId())))
            .toList();
        return new PageImpl<>(rows, pageable, page.getTotalElements());
    }

    public AdminObligationDetailDto detail(Long id) {
        ObligationMapping o = obligations.findById(id)
            .orElseThrow(() -> new RuntimeException("Obligation not found: " + id));
        Regulation act = o.getRegulationId() != null
            ? regulations.findById(o.getRegulationId()).orElse(null)
            : null;
        return AdminObligationDetailDto.builder()
            .obligationId(o.getObligationId())
            .obligationNumber(o.getObligationNumber())
            .title(o.getTitle())
            .description(o.getDescription())
            .plainEnglishStatement(o.getPlainEnglishStatement())
            .specificSectionReference(o.getSpecificSectionReference())
            .areaOfFocus(o.getAreaOfFocus())
            .obligationType(o.getObligationType())
            .recurringDeadlineType(o.getRecurringDeadlineType())
            .complianceDeadlineDays(o.getComplianceDeadlineDays())
            .riskDescription(o.getRiskDescription())
            .inherentLikelihood(o.getInherentLikelihood())
            .inherentImpact(o.getInherentImpact())
            .inherentRiskRating(o.getInherentRiskRating())
            .controlOwner(o.getControlOwner())
            .createdAt(o.getCreatedAt())
            .regulationId(o.getRegulationId())
            .actName(act != null ? act.getName() : null)
            .actAbbreviation(act != null ? act.getAbbreviation() : null)
            .instrumentId(o.getInstrumentId())
            .build();
    }

    public Map<String, Object> stats() {
        Map<String, Long> byRisk = tally(obligations.groupByInherentRiskRating());
        Map<String, Long> byArea = tally(obligations.groupByAreaOfFocus());
        Map<String, Long> byType = tally(obligations.groupByObligationType());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalObligations", obligations.count());
        out.put("byRiskRating", byRisk);
        out.put("byAreaOfFocus", byArea);
        out.put("byObligationType", byType);
        out.put("riskRatings", byRisk.keySet().stream().sorted().toList());
        out.put("areasOfFocus", byArea.keySet().stream().sorted().toList());
        out.put("obligationTypes", byType.keySet().stream().sorted().toList());
        out.put("highRiskCount", byRisk.getOrDefault("Critical", 0L) + byRisk.getOrDefault("Extreme", 0L) + byRisk.getOrDefault("High", 0L));
        out.put("areaCount", byArea.size());
        return out;
    }

    private Map<Long, String> resolveActNames(List<ObligationMapping> rows) {
        Set<Long> ids = rows.stream()
            .map(ObligationMapping::getRegulationId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return regulations.findAllById(ids).stream()
            .collect(Collectors.toMap(Regulation::getRegulationId, Regulation::getName, (a, b) -> a));
    }

    private Map<String, Long> tally(List<Object[]> grouped) {
        return grouped.stream()
            .filter(r -> r[0] != null)
            .collect(Collectors.toMap(
                r -> String.valueOf(r[0]),
                r -> ((Number) r[1]).longValue(),
                Long::sum,
                LinkedHashMap::new));
    }

    private AdminObligationDto toDto(ObligationMapping o, String actName) {
        return AdminObligationDto.builder()
            .obligationId(o.getObligationId())
            .obligationNumber(o.getObligationNumber())
            .title(o.getTitle())
            .description(o.getDescription())
            .plainEnglishStatement(o.getPlainEnglishStatement())
            .specificSectionReference(o.getSpecificSectionReference())
            .areaOfFocus(o.getAreaOfFocus())
            .obligationType(o.getObligationType())
            .recurringDeadlineType(o.getRecurringDeadlineType())
            .inherentRiskRating(o.getInherentRiskRating())
            .inherentLikelihood(o.getInherentLikelihood())
            .inherentImpact(o.getInherentImpact())
            .regulationId(o.getRegulationId())
            .actName(actName)
            .instrumentId(o.getInstrumentId())
            .build();
    }
}
