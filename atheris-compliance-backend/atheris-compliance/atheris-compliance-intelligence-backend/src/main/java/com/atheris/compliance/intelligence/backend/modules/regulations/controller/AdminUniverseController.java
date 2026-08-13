package com.atheris.compliance.intelligence.backend.modules.regulations.controller;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.AreaOfFocus;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.AreaOfFocusRepository;
import com.atheris.compliance.common.Constants;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/universe")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminUniverseController {

    private final InstrumentRepository instruments;
    private final RegulatorRepository regulators;
    private final AreaOfFocusRepository areas;

    @GetMapping("/instruments")
    public ResponseEntity<Page<Map<String, Object>>> list(
            @RequestParam(required = false) Integer regulatorId,
            @RequestParam(required = false) String areaOfFocus,
            @RequestParam(required = false) String riskRating,
            @RequestParam(required = false) String nature,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            Pageable pageable) {

        Specification<Instrument> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (regulatorId != null) predicates.add(cb.equal(root.get("regulatorId"), regulatorId));
            if (areaOfFocus != null && !areaOfFocus.isBlank()) predicates.add(cb.equal(root.get("areaOfFocus"), areaOfFocus));
            if (riskRating != null && !riskRating.isBlank()) predicates.add(cb.equal(root.get("riskRating"), riskRating));
            if (nature != null && !nature.isBlank()) predicates.add(cb.equal(root.get("nature"), nature));
            if (status != null && !status.isBlank()) predicates.add(cb.equal(root.get("status"), status));
            if (q != null && !q.isBlank()) predicates.add(cb.like(cb.lower(root.get("sourceTitle")), "%" + q.toLowerCase() + "%"));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Instrument> page = instruments.findAll(spec, pageable);
        List<Map<String, Object>> items = page.getContent().stream().map(i -> {
            String regName = i.getRegulatorId() != null
                ? regulators.findById(i.getRegulatorId()).map(r -> r.getName()).orElse(null)
                : null;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("instrumentId", i.getInstrumentId());
            m.put("sourceTitle", i.getSourceTitle());
            m.put("regulatorId", i.getRegulatorId());
            m.put("regulatorName", regName);
            m.put("regulationId", i.getRegulationId());
            m.put("regulatoryItemType", i.getRegulatoryItemType());
            m.put("nature", i.getNature());
            m.put("areaOfFocus", i.getAreaOfFocus());
            m.put("riskRating", i.getRiskRating());
            m.put("dateIssued", i.getDateIssued());
            m.put("dateCommencement", i.getDateCommencement());
            m.put("status", i.getStatus());
            m.put("applicabilityToCommercialBanks", i.getApplicabilityToCommercialBanks());
            m.put("hasPdf", i.getPdfUrl() != null);
            m.put("documentUrl", i.getDocumentUrl());
            m.put("sourceUrl", i.getSourceUrl());
            m.put("commentOnStatus", i.getCommentOnStatus());
            return m;
        }).toList();

        return ResponseEntity.ok(new PageImpl<>(items, pageable, page.getTotalElements()));
    }

    @GetMapping("/areas-of-focus")
    public ResponseEntity<List<Map<String, Object>>> areasOfFocus() {
        return ResponseEntity.ok(areas.findAll().stream()
            .map(a -> Map.<String, Object>of("name", a.getName(), "areaId", a.getAreaId()))
            .toList());
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        List<Instrument> all = instruments.findAll();
        Map<String, Long> byRegulator = all.stream()
            .filter(i -> i.getRegulatorId() != null)
            .collect(Collectors.groupingBy(i -> String.valueOf(i.getRegulatorId()), Collectors.counting()));
        Map<String, Object> regulatorStats = byRegulator.entrySet().stream().collect(Collectors.toMap(
            e -> {
                Integer id = Integer.valueOf(e.getKey());
                return regulators.findById(id).map(r -> r.getName()).orElse(e.getKey());
            }, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));

        Map<String, Long> byArea = all.stream()
            .filter(i -> i.getAreaOfFocus() != null)
            .collect(Collectors.groupingBy(Instrument::getAreaOfFocus, Collectors.counting()));
        Map<String, Long> byRisk = all.stream()
            .filter(i -> i.getRiskRating() != null)
            .collect(Collectors.groupingBy(Instrument::getRiskRating, Collectors.counting()));
        Map<String, Long> byNature = all.stream()
            .filter(i -> i.getNature() != null)
            .collect(Collectors.groupingBy(Instrument::getNature, Collectors.counting()));

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("total", all.size());
        resp.put("byRegulator", regulatorStats);
        resp.put("byAreaOfFocus", byArea);
        resp.put("byRiskRating", byRisk);
        resp.put("byNature", byNature);
        return ResponseEntity.ok(resp);
    }
}