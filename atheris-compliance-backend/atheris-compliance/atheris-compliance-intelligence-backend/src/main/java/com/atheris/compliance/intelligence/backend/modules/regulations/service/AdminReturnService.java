package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminReturnDetailDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminReturnDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulatoryReturn;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulatoryReturnRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class AdminReturnService {

    private final RegulatoryReturnRepository returns;
    private final RegulationRepository acts;

    public Page<AdminReturnDto> list(String q, Long actId, String frequencyType, String responsibleUnit, Pageable pageable) {
        Page<RegulatoryReturn> page = returns.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("title")), like),
                    cb.like(cb.lower(root.get("statutoryBasis")), like),
                    cb.like(cb.lower(root.get("remarks")), like)));
            }
            if (actId != null) predicates.add(cb.equal(root.get("actId"), actId));
            if (frequencyType != null && !frequencyType.isBlank())
                predicates.add(cb.equal(root.get("frequencyType"), frequencyType));
            if (responsibleUnit != null && !responsibleUnit.isBlank())
                predicates.add(cb.equal(root.get("responsibleUnit"), responsibleUnit));
            return cb.and(predicates.toArray(new Predicate[0]));
        }, pageable);

        Map<Long, String> actNames = actNamesFor(page.getContent());
        return page.map(r -> toDto(r, actNames.get(r.getActId())));
    }

    public AdminReturnDetailDto detail(Long id) {
        RegulatoryReturn r = returns.findById(id)
            .orElseThrow(() -> new RuntimeException("Return not found: " + id));
        Regulation act = r.getActId() != null ? acts.findById(r.getActId()).orElse(null) : null;
        return AdminReturnDetailDto.builder()
            .returnId(r.getReturnId())
            .title(r.getTitle())
            .sectionReference(r.getSectionReference())
            .statutoryBasis(r.getStatutoryBasis())
            .frequency(r.getFrequency())
            .frequencyType(r.getFrequencyType())
            .deadline(r.getDeadline())
            .remarks(r.getRemarks())
            .responsibleUnit(r.getResponsibleUnit())
            .responsiblePerson(r.getResponsiblePerson())
            .actId(r.getActId())
            .actName(act != null ? act.getName() : null)
            .actAbbreviation(act != null ? act.getAbbreviation() : null)
            .instrumentId(r.getInstrumentId())
            .filingDate(r.getFilingDate())
            .createdAt(r.getCreatedAt())
            .build();
    }

    public Map<String, Object> stats() {
        List<RegulatoryReturn> all = returns.findAll();
        Map<String, Long> byFrequencyType = countBy(all, RegulatoryReturn::getFrequencyType);
        Map<String, Long> byResponsibleUnit = countBy(all, RegulatoryReturn::getResponsibleUnit);
        long unassigned = all.stream()
            .filter(r -> isBlank(r.getResponsibleUnit()) && isBlank(r.getResponsiblePerson()))
            .count();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalReturns", (long) all.size());
        out.put("frequencyTypeCount", (long) byFrequencyType.size());
        out.put("responsibleUnitCount", (long) byResponsibleUnit.size());
        out.put("unassignedCount", unassigned);
        out.put("byFrequencyType", byFrequencyType);
        out.put("byResponsibleUnit", byResponsibleUnit);
        out.put("frequencyTypes", List.copyOf(byFrequencyType.keySet()));
        out.put("responsibleUnits", List.copyOf(byResponsibleUnit.keySet()));
        return out;
    }

    private Map<Long, String> actNamesFor(List<RegulatoryReturn> rows) {
        Set<Long> ids = rows.stream()
            .map(RegulatoryReturn::getActId)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return acts.findAllById(ids).stream()
            .filter(a -> a.getName() != null)
            .collect(Collectors.toMap(Regulation::getRegulationId, Regulation::getName, (a, b) -> a));
    }

    private Map<String, Long> countBy(List<RegulatoryReturn> all, Function<RegulatoryReturn, String> field) {
        return all.stream()
            .map(field)
            .filter(v -> !isBlank(v))
            .collect(Collectors.groupingBy(Function.identity(), TreeMap::new, Collectors.counting()));
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private AdminReturnDto toDto(RegulatoryReturn r, String actName) {
        return AdminReturnDto.builder()
            .returnId(r.getReturnId())
            .title(r.getTitle())
            .sectionReference(r.getSectionReference())
            .frequency(r.getFrequency())
            .frequencyType(r.getFrequencyType())
            .deadline(r.getDeadline())
            .responsibleUnit(r.getResponsibleUnit())
            .responsiblePerson(r.getResponsiblePerson())
            .actId(r.getActId())
            .actName(actName)
            .instrumentId(r.getInstrumentId())
            .filingDate(r.getFilingDate())
            .build();
    }
}
