package com.atheris.compliance.intelligence.backend.modules.regulations.service;

import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminReturnDetailDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.dto.AdminReturnDto;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulatoryReturn;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulatoryReturnRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class AdminReturnService {

    /**
     * Entity attributes the list may be sorted on directly; aliases (e.g. the service-resolved
     * {@code actName}) are resolved in {@link #sortPath}, and anything unknown is ignored rather
     * than passed to {@code Pageable} (which would raise PropertyReferenceException).
     */
    private static final Set<String> SORTABLE = Set.of(
            "returnId", "actId", "instrumentId", "title", "sectionReference", "statutoryBasis",
            "responsibleUnit", "responsiblePerson", "frequency", "frequencyType", "deadline",
            "remarks", "filingDate", "createdAt");

    private final RegulatoryReturnRepository returns;
    private final RegulationRepository acts;

    @PersistenceContext
    private EntityManager em;

    public Page<AdminReturnDto> list(String q, Long actId, String frequencyType, String responsibleUnit, Pageable pageable) {
        Sort sort = pageable.getSort();
        Page<RegulatoryReturn> page = returns.findAll((root, query, cb) -> {
            // Sort is applied inside the spec (so aliases/unknown fields are handled gracefully),
            // therefore page below WITHOUT the Pageable sort.
            if (!Long.class.equals(query.getResultType()) && !long.class.equals(query.getResultType())) {
                query.orderBy(orders(sort, root, cb));
            }
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
        }, PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()));

        Map<Long, String> actNames = actNamesFor(page.getContent());
        return page.map(r -> toDto(r, actNames.get(r.getActId())));
    }

    // --------------------------------------------------------------- sorting

    private List<Order> orders(Sort sort, Root<RegulatoryReturn> root, CriteriaBuilder cb) {
        List<Order> out = new ArrayList<>();
        for (Sort.Order o : sort) {
            Expression<?> expr = sortPath(o.getProperty(), root);
            if (expr != null) out.add(o.isAscending() ? cb.asc(expr) : cb.desc(expr));
        }
        out.add(cb.asc(root.get("returnId"))); // stable paging
        return out;
    }

    private Expression<?> sortPath(String prop, Root<RegulatoryReturn> root) {
        return switch (prop == null ? "" : prop) {
            case "actName" -> root.get("actId"); // actName is service-resolved; sort by its FK
            default -> SORTABLE.contains(prop) ? root.get(prop) : null;
        };
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
        long total = returns.count();
        Map<String, Long> byFrequencyType = groupCount("frequencyType");
        Map<String, Long> byResponsibleUnit = groupCount("responsibleUnit");
        long unassigned = returns.count((root, query, cb) -> cb.and(
            cb.or(cb.isNull(root.get("responsibleUnit")), cb.equal(root.get("responsibleUnit"), "")),
            cb.or(cb.isNull(root.get("responsiblePerson")), cb.equal(root.get("responsiblePerson"), ""))));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalReturns", total);
        out.put("frequencyTypeCount", (long) byFrequencyType.size());
        out.put("responsibleUnitCount", (long) byResponsibleUnit.size());
        out.put("unassignedCount", unassigned);
        out.put("byFrequencyType", byFrequencyType);
        out.put("byResponsibleUnit", byResponsibleUnit);
        out.put("frequencyTypes", List.copyOf(byFrequencyType.keySet()));
        out.put("responsibleUnits", List.copyOf(byResponsibleUnit.keySet()));
        out.put("acts", actsForFilter());
        return out;
    }

    /** Group-by counts for a persisted String column, via a JPA criteria aggregate (not findAll). */
    private Map<String, Long> groupCount(String attribute) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        var cq = cb.createTupleQuery();
        Root<RegulatoryReturn> root = cq.from(RegulatoryReturn.class);
        Expression<String> path = root.get(attribute);
        cq.multiselect(path, cb.count(root));
        cq.where(cb.isNotNull(path));
        cq.groupBy(path);
        cq.orderBy(cb.asc(path));
        Map<String, Long> out = new TreeMap<>();
        for (Tuple t : em.createQuery(cq).getResultList()) {
            String key = t.get(0, String.class);
            if (!isBlank(key)) out.put(key, t.get(1, Long.class));
        }
        return out;
    }

    /** Distinct acts referenced by returns, for the Act filter dropdown. */
    private List<Map<String, Object>> actsForFilter() {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        var cq = cb.createTupleQuery();
        Root<RegulatoryReturn> root = cq.from(RegulatoryReturn.class);
        Expression<Long> actIdPath = root.get("actId");
        cq.multiselect(actIdPath, cb.count(root));
        cq.where(cb.isNotNull(actIdPath));
        cq.groupBy(actIdPath);
        List<Long> ids = new ArrayList<>();
        for (Tuple t : em.createQuery(cq).getResultList()) ids.add(t.get(0, Long.class));

        if (ids.isEmpty()) return List.of();
        List<Regulation> resolved = acts.findAllById(ids);
        return resolved.stream()
            .filter(a -> a.getName() != null)
            .sorted((a, b) -> a.getName().compareToIgnoreCase(b.getName()))
            .map(a -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("actId", a.getRegulationId());
                m.put("name", a.getName());
                return m;
            })
            .collect(Collectors.toList());
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
