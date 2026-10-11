package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.entity.Regulator;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.RegulationDetailDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.RegulationDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulatoryReturn;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.ComplianceControlRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulatoryReturnRepository;
import com.atheris.compliance.intelligence.backend.modules.sanctions.entity.SanctionsPenalty;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class RegulationService {

    private final RegulationRepository regulationRepo;
    private final RegulatorRepository regulators;
    private final InstrumentRepository instruments;
    private final ObligationMappingRepository obligations;
    private final SanctionsRepository sanctions;
    private final RegulatoryReturnRepository returns;
    private final ComplianceControlRepository controls;

    @PersistenceContext private EntityManager em;

    private static final int TOP_ACTS = 8;

    public Page<RegulationDto> list(String q, Integer regulatorId, Pageable pageable) {
        Pageable unsorted = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        Page<Regulation> page = regulationRepo.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank())
                predicates.add(cb.like(cb.lower(root.get("name")), "%" + q.toLowerCase() + "%"));
            if (regulatorId != null)
                predicates.add(cb.equal(root.get("regulatorId"), regulatorId));

            // Ordering is applied here (not via Pageable) because the count columns are
            // service-resolved, not entity properties — sorting is done with correlated subqueries.
            if (query != null && query.getResultType() != Long.class && query.getResultType() != long.class) {
                org.springframework.data.domain.Sort.Order so = pageable.getSort().stream().findFirst().orElse(null);
                String prop = so != null ? so.getProperty() : "name";
                boolean desc = so == null || so.isDescending();
                jakarta.persistence.criteria.Order order = countOrder(root, query, cb, prop, desc);
                if (order == null) order = desc ? cb.desc(root.get("name")) : cb.asc(root.get("name"));
                jakarta.persistence.criteria.Order tie = desc ? cb.desc(root.get("regulationId")) : cb.asc(root.get("regulationId"));
                query.orderBy(order, tie);
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        }, unsorted);

        // One grouped count per entity for the page's act ids (no N+1).
        List<Long> actIds = page.getContent().stream().map(Regulation::getRegulationId).toList();
        Map<Long, Long> inst = countsByAct(Instrument.class, "regulationId", actIds);
        Map<Long, Long> obl = countsByAct(ObligationMapping.class, "regulationId", actIds);
        Map<Long, Long> san = countsByAct(SanctionsPenalty.class, "regulationId", actIds);
        Map<Long, Long> ret = countsByAct(RegulatoryReturn.class, "actId", actIds);
        Map<Long, Long> ctl = countsByAct(ComplianceControl.class, "actId", actIds);

        Map<Integer, String> regulatorNames = regulatorNames(page.getContent().stream()
            .map(Regulation::getRegulatorId).filter(Objects::nonNull).collect(Collectors.toSet()));

        return page.map(r -> toDto(r, regulatorNames, inst, obl, san, ret, ctl));
    }

    public RegulationDetailDto detail(Long id) {
        Regulation reg = regulationRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Act not found: " + id));
        String regName = reg.getRegulatorId() != null
            ? regulators.findById(reg.getRegulatorId()).map(Regulator::getName).orElse(null)
            : null;
        return RegulationDetailDto.builder()
            .regulationId(reg.getRegulationId())
            .name(reg.getName())
            .abbreviation(reg.getAbbreviation())
            .description(reg.getDescription())
            .regulatorId(reg.getRegulatorId())
            .regulatorName(regName)
            .status(reg.getStatus())
            .instrumentCount((int) instruments.countByRegulationId(id))
            .obligationCount((int) obligations.countByRegulationId(id))
            .sanctionCount((int) sanctions.countByRegulationId(id))
            .returnCount((int) returns.countByActId(id))
            .controlCount(controls.findByActId(id).size())
            .build();
    }

    @Transactional
    public RegulationDto update(Long id, RegulationDto req) {
        Regulation reg = regulationRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Act not found: " + id));
        if (req.getName() != null) reg.setName(req.getName());
        if (req.getAbbreviation() != null) reg.setAbbreviation(req.getAbbreviation());
        if (req.getDescription() != null) reg.setDescription(req.getDescription());
        if (req.getRegulatorId() != null) reg.setRegulatorId(req.getRegulatorId());
        if (req.getStatus() != null) reg.setStatus(req.getStatus());
        return toDto(regulationRepo.save(reg), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of());
    }

    public Map<String, Object> stats() {
        long totalActs = regulationRepo.count();
        long totalInstruments = instruments.count();
        long totalObligations = obligations.count();
        long totalSanctions = sanctions.count();
        long totalReturns = returns.count();
        long totalControls = controls.count();

        // Breakdown facets
        Map<Long, Long> byRegulator = groupCount(Regulation.class, "regulatorId");
        Map<Long, Long> topInstruments = topActs(Instrument.class, "regulationId");
        Map<Long, Long> topObligations = topActs(ObligationMapping.class, "regulationId");
        Map<Long, Long> topSanctions = topActs(SanctionsPenalty.class, "regulationId");
        Map<Long, Long> topReturns = topActs(RegulatoryReturn.class, "actId");
        Map<Long, Long> topControls = topActs(ComplianceControl.class, "actId");

        Map<Integer, String> regNames = regulatorNames(
            byRegulator.keySet().stream().map(Long::intValue).collect(Collectors.toSet()));
        List<Map<String, Object>> byRegulatorNamed = byRegulator.entrySet().stream()
            .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
            .map(e -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("regulatorId", e.getKey());
                m.put("name", regNames.getOrDefault(e.getKey().intValue(), "Regulator " + e.getKey()));
                m.put("count", e.getValue());
                return m;
            }).toList();

        List<Map<String, Object>> regulatorsFacet = actRegulators();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalActs", totalActs);
        out.put("totalInstruments", totalInstruments);
        out.put("totalObligations", totalObligations);
        out.put("totalSanctions", totalSanctions);
        out.put("totalReturns", totalReturns);
        out.put("totalControls", totalControls);
        out.put("regulators", regulatorsFacet);                 // [{regulatorId, name}] for the filter
        out.put("byRegulator", byRegulatorNamed);               // Total Acts breakdown
        out.put("topInstruments", topActList(topInstruments));
        out.put("topObligations", topActList(topObligations));
        out.put("topSanctions", topActList(topSanctions));
        out.put("topReturns", topActList(topReturns));
        out.put("topControls", topActList(topControls));
        return out;
    }

    // ── helpers ──

    /**
     * Builds an ORDER BY for a service-resolved column via a correlated subquery. The count
     * columns are not entity properties, so a plain `Sort` would throw PropertyReferenceException.
     */
    private jakarta.persistence.criteria.Order countOrder(Root<Regulation> root,
            jakarta.persistence.criteria.CriteriaQuery<?> query, CriteriaBuilder cb, String prop, boolean desc) {
        Class<?> entity;
        String field;
        switch (prop) {
            case "name": return desc ? cb.desc(root.get("name")) : cb.asc(root.get("name"));
            case "status": return desc ? cb.desc(root.get("status")) : cb.asc(root.get("status"));
            case "regulatorId": return desc ? cb.desc(root.get("regulatorId")) : cb.asc(root.get("regulatorId"));
            case "instrumentCount": entity = Instrument.class; field = "regulationId"; break;
            case "obligationCount": entity = ObligationMapping.class; field = "regulationId"; break;
            case "sanctionCount": entity = SanctionsPenalty.class; field = "regulationId"; break;
            case "returnCount": entity = RegulatoryReturn.class; field = "actId"; break;
            case "controlCount": entity = ComplianceControl.class; field = "actId"; break;
            default: return null;
        }
        var sub = query.subquery(Long.class);
        Root<?> sr = sub.from(entity);
        sub.select(cb.count(sr));
        sub.where(cb.equal(sr.get(field), root.get("regulationId")));
        return desc ? cb.desc(sub) : cb.asc(sub);
    }

    /** Grouped row counts per act id for a child entity — one query, no per-row N+1. */
    private Map<Long, Long> countsByAct(Class<?> entity, String actField, Collection<Long> actIds) {
        if (actIds == null || actIds.isEmpty()) return Map.of();
        CriteriaBuilder cb = em.getCriteriaBuilder();
        var cq = cb.createTupleQuery();
        Root<?> root = cq.from(entity);
        Path<?> actPath = root.get(actField);
        cq.multiselect(actPath, cb.count(root));
        cq.where(actPath.in(actIds));
        cq.groupBy(actPath);
        Map<Long, Long> out = new LinkedHashMap<>();
        for (Tuple t : em.createQuery(cq).getResultList()) {
            Object k = t.get(0);
            if (k == null) continue;
            out.put(((Number) k).longValue(), t.get(1, Long.class));
        }
        return out;
    }

    private Map<Long, Long> groupCount(Class<?> entity, String field) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        var cq = cb.createTupleQuery();
        Root<?> root = cq.from(entity);
        Path<?> path = root.get(field);
        cq.multiselect(path, cb.count(root));
        cq.where(cb.isNotNull(path));
        cq.groupBy(path);
        Map<Long, Long> out = new LinkedHashMap<>();
        for (Tuple t : em.createQuery(cq).getResultList()) {
            Object k = t.get(0);
            if (k == null) continue;
            long key = ((Number) k).longValue();
            out.put(key, t.get(1, Long.class));
        }
        return out;
    }

    private Map<Long, Long> topActs(Class<?> entity, String actField) {
        return groupCount(entity, actField).entrySet().stream()
            .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
            .limit(TOP_ACTS)
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));
    }

    private List<Map<String, Object>> topActList(Map<Long, Long> counts) {
        if (counts.isEmpty()) return List.of();
        Map<Long, String> names = actNames(counts.keySet());
        return counts.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("actId", e.getKey());
            m.put("name", names.getOrDefault(e.getKey(), "Act " + e.getKey()));
            m.put("count", e.getValue());
            return m;
        }).toList();
    }

    private List<Map<String, Object>> actRegulators() {
        List<Regulator> all = new ArrayList<>(regulators.findAll());
        all.sort(Comparator.comparing(r -> r.getName() == null ? "" : r.getName(), String.CASE_INSENSITIVE_ORDER));
        return all.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("regulatorId", r.getRegulatorId());
            m.put("name", r.getName());
            return m;
        }).toList();
    }

    private Map<Integer, String> regulatorNames(Collection<Integer> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return regulators.findAllById(ids).stream()
            .collect(Collectors.toMap(Regulator::getRegulatorId, Regulator::getName, (a, b) -> a));
    }

    private Map<Long, String> actNames(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return regulationRepo.findAllById(ids).stream()
            .filter(r -> r.getName() != null)
            .collect(Collectors.toMap(Regulation::getRegulationId, Regulation::getName, (a, b) -> a));
    }

    private RegulationDto toDto(Regulation r, Map<Integer, String> regulatorNames,
                                Map<Long, Long> inst, Map<Long, Long> obl, Map<Long, Long> san,
                                Map<Long, Long> ret, Map<Long, Long> ctl) {
        Long id = r.getRegulationId();
        return RegulationDto.builder()
            .regulationId(id)
            .name(r.getName())
            .abbreviation(r.getAbbreviation())
            .description(r.getDescription())
            .regulatorId(r.getRegulatorId())
            .regulatorName(r.getRegulatorId() != null ? regulatorNames.get(r.getRegulatorId()) : null)
            .status(r.getStatus())
            .instrumentCount(inst.getOrDefault(id, 0L))
            .obligationCount(obl.getOrDefault(id, 0L))
            .sanctionCount(san.getOrDefault(id, 0L))
            .returnCount(ret.getOrDefault(id, 0L))
            .controlCount(ctl.getOrDefault(id, 0L))
            .build();
    }
}
