package com.atheris.compliance.intelligence.backend.modules.obligations.service;

import com.atheris.compliance.intelligence.backend.modules.browser.service.ObligationBrowserService;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.obligations.dto.ObligationExplorerDetail;
import com.atheris.compliance.intelligence.backend.modules.obligations.dto.ObligationExplorerItem;
import com.atheris.compliance.intelligence.backend.modules.obligations.dto.ObligationExplorerStats;
import com.atheris.compliance.intelligence.backend.modules.obligations.entity.ObligationMapping;
import com.atheris.compliance.intelligence.backend.modules.obligations.repository.ObligationMappingRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.ComplianceControl;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.Regulation;
import com.atheris.compliance.intelligence.backend.modules.regulations.entity.RegulatoryReturn;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.ComplianceControlRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulationRepository;
import com.atheris.compliance.intelligence.backend.modules.regulations.repository.RegulatoryReturnRepository;
import com.atheris.compliance.intelligence.backend.modules.regulators.entity.Regulator;
import com.atheris.compliance.intelligence.backend.modules.regulators.repository.RegulatorRepository;
import com.atheris.compliance.intelligence.backend.modules.sanctions.entity.SanctionsPenalty;
import com.atheris.compliance.intelligence.backend.modules.sanctions.repository.SanctionsRepository;
import com.atheris.compliance.intelligence.backend.shared.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Platform-admin obligations explorer: list (JPA criteria filters, page-only enrichment),
 * stats (criteria aggregates — also feeds the dashboard RegulatoryCoverage section),
 * detail, linked controls and the instrument PDF.
 */
@Service @Slf4j @RequiredArgsConstructor
@Transactional(readOnly = true)
public class ObligationExplorerService {

    private static final Set<String> HIGH_RISK = Set.of("critical", "extreme", "high");
    /** Entity attributes the list may be sorted on directly; aliases are resolved in {@link #sortPath}. */
    private static final Set<String> SORTABLE = Set.of(
            "obligationId", "obligationNumber", "title", "areaOfFocus", "obligationType",
            "recurringDeadlineType", "specificSectionReference", "inherentLikelihood",
            "inherentImpact", "createdAt", "regulationId", "instrumentId");

    private final ObligationMappingRepository obligationRepo;
    private final InstrumentRepository instrumentRepo;
    private final RegulationRepository regulationRepo;
    private final RegulatorRepository regulatorRepo;
    private final SanctionsRepository sanctionsRepo;
    private final RegulatoryReturnRepository returnRepo;
    private final ComplianceControlRepository controlRepo;
    private final ObligationBrowserService browserService;

    @PersistenceContext
    private EntityManager em;

    /** Filters accepted by the list endpoint. Text filters are case-insensitive. */
    public record ListFilter(
            String q,
            String risk,                // inherent risk rating ("inherentRiskRating" is an alias)
            Integer regulatorId,
            String regulator,           // regulator abbreviation (what the stats option list holds)
            String areaOfFocus,
            Long actId,                 // "regulationId" is an alias
            String act,                 // act name (what the stats option list holds)
            String obligationType,
            Boolean hasPoints) {}

    // ------------------------------------------------------------------ list

    public Page<ObligationExplorerItem> list(ListFilter f, Pageable pageable) {
        Set<Integer> regulatorIds = resolveRegulatorIds(f.regulatorId(), f.regulator());
        Sort sort = pageable.getSort();
        Specification<ObligationMapping> spec = (root, query, cb) -> {
            if (!Long.class.equals(query.getResultType()) && !long.class.equals(query.getResultType())) {
                query.orderBy(orders(sort, root, cb));
            }
            return cb.and(predicates(f, regulatorIds, root, query, cb).toArray(new Predicate[0]));
        };
        // sort is applied inside the spec (risk needs a CASE ordering), so page without it
        Page<ObligationMapping> page = obligationRepo.findAll(spec,
                PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()));

        List<ObligationMapping> rows = page.getContent();
        Map<Long, Instrument> instrumentMap = instrumentsFor(rows);
        Map<Long, Regulation> regulationMap = regulationsFor(rows);
        Map<Integer, Regulator> regulatorMap = regulatorsFor(instrumentMap.values(), regulationMap.values());

        List<ObligationExplorerItem> items = rows.stream()
                .map(ob -> toItem(ob, instrumentMap, regulationMap, regulatorMap))
                .toList();
        return new PageImpl<>(items, pageable, page.getTotalElements());
    }

    private List<Predicate> predicates(ListFilter f, Set<Integer> regulatorIds,
                                       Root<ObligationMapping> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        List<Predicate> ps = new ArrayList<>();
        if (notBlank(f.q())) {
            String like = "%" + f.q().trim().toLowerCase() + "%";
            ps.add(cb.or(
                    likeLower(cb, root.<String>get("title"), like),
                    likeLower(cb, root.<String>get("description"), like),
                    likeLower(cb, root.<String>get("plainEnglishStatement"), like),
                    likeLower(cb, root.<String>get("specificSectionReference"), like),
                    likeLower(cb, root.<String>get("areaOfFocus"), like),
                    likeLower(cb, root.<String>get("inherentRiskRating"), like),
                    root.get("regulationId").in(regulationIdsWhere(query, cb, like, "name")),
                    root.get("instrumentId").in(instrumentIdsWhereTitle(query, cb, like)),
                    regulatorMatches(root, query, cb, regulatorIdsWhereAbbreviation(query, cb, like))));
        }
        if (notBlank(f.risk())) ps.add(eqLower(cb, root.<String>get("inherentRiskRating"), f.risk()));
        if (notBlank(f.areaOfFocus())) ps.add(eqLower(cb, root.<String>get("areaOfFocus"), f.areaOfFocus()));
        if (notBlank(f.obligationType())) ps.add(eqLower(cb, root.<String>get("obligationType"), f.obligationType()));
        if (f.actId() != null) ps.add(cb.equal(root.get("regulationId"), f.actId()));
        if (notBlank(f.act())) {
            Subquery<Long> acts = query.subquery(Long.class);
            Root<Regulation> r = acts.from(Regulation.class);
            acts.select(r.<Long>get("regulationId")).where(eqLower(cb, r.<String>get("name"), f.act()));
            ps.add(root.get("regulationId").in(acts));
        }
        if (regulatorIds != null) {
            if (regulatorIds.isEmpty()) ps.add(cb.disjunction());
            else ps.add(regulatorMatches(root, query, cb, regulatorIds));
        }
        if (f.hasPoints() != null) {
            Path<Object> points = root.get("points");
            Expression<Integer> len = cb.function("jsonb_array_length", Integer.class, points);
            ps.add(f.hasPoints()
                    ? cb.and(cb.isNotNull(points), cb.gt(len, 0))
                    : cb.or(cb.isNull(points), cb.equal(len, 0)));
        }
        return ps;
    }

    /** An obligation belongs to a regulator through its instrument, or else through its act. */
    private Predicate regulatorMatches(Root<ObligationMapping> root, CriteriaQuery<?> query,
                                       CriteriaBuilder cb, Object regulatorIds) {
        Subquery<Long> insts = query.subquery(Long.class);
        Root<Instrument> i = insts.from(Instrument.class);
        insts.select(i.<Long>get("instrumentId")).where(inValues(i.get("regulatorId"), regulatorIds));

        Subquery<Long> acts = query.subquery(Long.class);
        Root<Regulation> r = acts.from(Regulation.class);
        acts.select(r.<Long>get("regulationId")).where(inValues(r.get("regulatorId"), regulatorIds));

        return cb.or(root.get("instrumentId").in(insts), root.get("regulationId").in(acts));
    }

    private static Predicate inValues(Path<Object> path, Object values) {
        return values instanceof Subquery<?> sq ? path.in(sq) : path.in((Collection<?>) values);
    }

    private Subquery<Long> regulationIdsWhere(CriteriaQuery<?> query, CriteriaBuilder cb, String like, String attr) {
        Subquery<Long> sq = query.subquery(Long.class);
        Root<Regulation> r = sq.from(Regulation.class);
        return sq.select(r.<Long>get("regulationId")).where(likeLower(cb, r.<String>get(attr), like));
    }

    private Subquery<Long> instrumentIdsWhereTitle(CriteriaQuery<?> query, CriteriaBuilder cb, String like) {
        Subquery<Long> sq = query.subquery(Long.class);
        Root<Instrument> i = sq.from(Instrument.class);
        return sq.select(i.<Long>get("instrumentId")).where(likeLower(cb, i.<String>get("sourceTitle"), like));
    }

    private Subquery<Integer> regulatorIdsWhereAbbreviation(CriteriaQuery<?> query, CriteriaBuilder cb, String like) {
        Subquery<Integer> sq = query.subquery(Integer.class);
        Root<Regulator> g = sq.from(Regulator.class);
        return sq.select(g.<Integer>get("regulatorId")).where(likeLower(cb, g.<String>get("abbreviation"), like));
    }

    /** null = no regulator filter; empty = filter that matches nothing (unknown abbreviation). */
    private Set<Integer> resolveRegulatorIds(Integer regulatorId, String abbreviation) {
        if (regulatorId == null && !notBlank(abbreviation)) return null;
        Set<Integer> ids = new HashSet<>();
        if (regulatorId != null) ids.add(regulatorId);
        if (notBlank(abbreviation)) {
            regulatorRepo.findAll().stream()
                    .filter(r -> abbreviation.trim().equalsIgnoreCase(r.getAbbreviation()))
                    .map(Regulator::getRegulatorId)
                    .forEach(ids::add);
            if (regulatorId != null && ids.size() > 1) ids.retainAll(Set.of(regulatorId)); // both given: must agree
        }
        return ids;
    }

    private List<Order> orders(Sort sort, Root<ObligationMapping> root, CriteriaBuilder cb) {
        List<Order> out = new ArrayList<>();
        for (Sort.Order o : sort) {
            Expression<?> expr = sortPath(o.getProperty(), root, cb);
            if (expr != null) out.add(o.isAscending() ? cb.asc(expr) : cb.desc(expr));
        }
        out.add(cb.asc(root.get("obligationId"))); // stable paging
        return out;
    }

    private Expression<?> sortPath(String prop, Root<ObligationMapping> root, CriteriaBuilder cb) {
        return switch (prop) {
            case "risk", "riskRating", "inherentRiskRating" -> cb.<Integer>selectCase()
                    .when(eqLower(cb, root.<String>get("inherentRiskRating"), "critical"), 4)
                    .when(eqLower(cb, root.<String>get("inherentRiskRating"), "high"), 3)
                    .when(eqLower(cb, root.<String>get("inherentRiskRating"), "moderate"), 2)
                    .when(eqLower(cb, root.<String>get("inherentRiskRating"), "low"), 1)
                    .otherwise(0);
            case "id" -> root.get("obligationId");
            case "sectionReference" -> root.get("specificSectionReference");
            case "actId" -> root.get("regulationId");
            default -> SORTABLE.contains(prop) ? root.get(prop) : null;
        };
    }

    // ------------------------------------------------------------------ stats

    public ObligationExplorerStats getStats() {
        long total = obligationRepo.count();
        long withPoints = obligationRepo.count((root, q, b) ->
                b.and(b.isNotNull(root.get("points")),
                        b.gt(b.function("jsonb_array_length", Integer.class, root.get("points")), 0)));

        Map<String, Long> byRisk = groupCount("inherentRiskRating");
        Map<String, Long> byArea = groupCount("areaOfFocus");
        Map<String, Long> byType = groupCount("obligationType");
        long highRisk = byRisk.entrySet().stream()
                .filter(e -> HIGH_RISK.contains(e.getKey().toLowerCase()))
                .mapToLong(Map.Entry::getValue).sum();

        // option lists: acts that carry obligations, and the regulators reached through instrument or act
        Set<Long> actIds = distinct("regulationId", Long.class);
        List<Regulation> acts = actIds.isEmpty() ? List.of() : regulationRepo.findAllById(actIds);
        Set<Integer> regulatorIds = new HashSet<>(distinctInstrumentRegulators());
        acts.stream().map(Regulation::getRegulatorId).filter(Objects::nonNull).forEach(regulatorIds::add);
        List<String> regulators = regulatorIds.isEmpty() ? List.of() : regulatorRepo.findAllById(regulatorIds).stream()
                .map(Regulator::getAbbreviation).filter(ObligationExplorerService::notBlank)
                .collect(Collectors.toCollection(TreeSet::new)).stream().toList();
        List<String> actNames = acts.stream().map(Regulation::getName).filter(ObligationExplorerService::notBlank)
                .collect(Collectors.toCollection(TreeSet::new)).stream().toList();

        List<String> risks = sortedKeys(byRisk);
        List<String> areas = sortedKeys(byArea);
        return ObligationExplorerStats.builder()
                .total(total)
                .highRisk(highRisk)
                .withPoints(withPoints)
                .withoutPoints(total - withPoints)
                .regulators(regulators)
                .areas(areas)
                .risks(risks)
                .acts(actNames)
                .totalObligations(total)
                .highRiskCount(highRisk)
                .areaCount(byArea.size())
                .byRiskRating(byRisk)
                .byAreaOfFocus(byArea)
                .byObligationType(byType)
                .riskRatings(risks)
                .areasOfFocus(areas)
                .obligationTypes(sortedKeys(byType))
                .build();
    }

    private Map<String, Long> groupCount(String attr) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Object[]> cq = cb.createQuery(Object[].class);
        Root<ObligationMapping> root = cq.from(ObligationMapping.class);
        cq.multiselect(root.get(attr), cb.count(root)).where(cb.isNotNull(root.get(attr))).groupBy(root.get(attr));
        Map<String, Long> out = new LinkedHashMap<>();
        for (Object[] row : em.createQuery(cq).getResultList()) {
            out.merge(String.valueOf(row[0]), ((Number) row[1]).longValue(), Long::sum);
        }
        return out;
    }

    private <T> Set<T> distinct(String attr, Class<T> type) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<T> cq = cb.createQuery(type);
        Root<ObligationMapping> root = cq.from(ObligationMapping.class);
        cq.select(root.<T>get(attr)).distinct(true).where(cb.isNotNull(root.get(attr)));
        return new HashSet<>(em.createQuery(cq).getResultList());
    }

    private List<Integer> distinctInstrumentRegulators() {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Integer> cq = cb.createQuery(Integer.class);
        Root<Instrument> i = cq.from(Instrument.class);
        Subquery<Long> obInsts = cq.subquery(Long.class);
        Root<ObligationMapping> o = obInsts.from(ObligationMapping.class);
        obInsts.select(o.<Long>get("instrumentId"));
        cq.select(i.<Integer>get("regulatorId")).distinct(true).where(i.get("instrumentId").in(obInsts));
        return em.createQuery(cq).getResultList();
    }

    private static List<String> sortedKeys(Map<String, Long> m) {
        return m.keySet().stream().sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    // ------------------------------------------------------------------ detail

    public ObligationExplorerDetail getDetail(Long id) {
        ObligationMapping ob = find(id);

        Instrument inst = ob.getInstrumentId() != null ? instrumentRepo.findById(ob.getInstrumentId()).orElse(null) : null;
        Regulation reg = ob.getRegulationId() != null ? regulationRepo.findById(ob.getRegulationId()).orElse(null) : null;
        Regulator regulator = resolveRegulator(inst, reg,
                regulatorsFor(inst != null ? List.of(inst) : List.of(), reg != null ? List.of(reg) : List.of()));

        String regulatorAbbr = regulator != null ? regulator.getAbbreviation() : null;
        String regulatorName = regulator != null ? regulator.getName() : null;
        Integer resolvedRegulatorId = regulator != null ? regulator.getRegulatorId() : (inst != null ? inst.getRegulatorId() : null);
        String actName = reg != null ? reg.getName() : null;

        ObligationExplorerDetail.InstrumentInfo instrumentInfo = null;
        if (inst != null) {
            instrumentInfo = ObligationExplorerDetail.InstrumentInfo.builder()
                    .instrumentId(inst.getInstrumentId())
                    .sourceTitle(inst.getSourceTitle())
                    .regulatorId(inst.getRegulatorId())
                    .regulatorAbbreviation(regulatorAbbr)
                    .regulatorName(regulatorName)
                    .regulationId(inst.getRegulationId())
                    .actName(actName)
                    .areaOfFocus(inst.getAreaOfFocus())
                    .nature(inst.getNature())
                    .riskRating(inst.getRiskRating())
                    .riskRatingExplanation(inst.getRiskRatingExplanation())
                    .regulatoryItemType(inst.getRegulatoryItemType())
                    .dateIssued(inst.getDateIssued())
                    .dateCommencement(inst.getDateCommencement())
                    .status(inst.getStatus())
                    .documentUrl(inst.getDocumentUrl())
                    .pdfUrl(inst.getPdfUrl())
                    .aiSummary(inst.getAiSummary())
                    .build();
        }

        boolean hasGap = ob.getControlOwner() == null || ob.getControlOwner().isBlank();

        return ObligationExplorerDetail.builder()
                .obligationId(ob.getObligationId())
                .obligationNumber(ob.getObligationNumber())
                .title(ob.getTitle())
                .description(ob.getDescription())
                .plainEnglishStatement(ob.getPlainEnglishStatement())
                .sectionReference(ob.getSpecificSectionReference())
                .areaOfFocus(ob.getAreaOfFocus())
                .obligationType(ob.getObligationType())
                .recurringDeadlineType(ob.getRecurringDeadlineType())
                .complianceDeadlineDays(ob.getComplianceDeadlineDays())
                .riskRating(ob.getInherentRiskRating())
                .riskDescription(ob.getRiskDescription())
                .inherentLikelihood(ob.getInherentLikelihood())
                .inherentImpact(ob.getInherentImpact())
                .controlOwner(ob.getControlOwner())
                .hasGap(hasGap)
                .gapDescription(hasGap ? ob.getRiskDescription() : null)
                .applicability(ob.getInherentRiskRating() != null ? "applicable" : null)
                .applicabilityReasoning(ob.getInherentRiskRating() != null
                        ? "Obligation has been assessed with inherent risk rating: " + ob.getInherentRiskRating()
                        : null)
                .classifiedByName(ob.getControlOwner())
                .classifiedAt(ob.getCreatedAt())
                .assignedOwnerName(ob.getControlOwner())
                .assignedDepartment(ob.getAreaOfFocus())
                .linkedControls(resolveControls(ob.getObligationId()))
                .evidence(List.of())
                .history(List.of())
                .regulatorAbbreviation(regulatorAbbr)
                .regulatorName(regulatorName)
                .regulatorId(resolvedRegulatorId)
                .actName(actName)
                .actAbbreviation(reg != null ? reg.getAbbreviation() : null)
                .actId(ob.getRegulationId())
                .instrumentTitle(inst != null ? inst.getSourceTitle() : null)
                .instrumentId(ob.getInstrumentId())
                .hasPoints(ob.getPoints() != null && !ob.getPoints().isEmpty())
                .points(ob.getPoints() != null ? ob.getPoints() : List.of())
                .createdAt(ob.getCreatedAt())
                .instrument(instrumentInfo)
                .sanctions(resolveSanctions(ob))
                .returns(resolveReturns(ob))
                .build();
    }

    public List<ObligationExplorerDetail.ControlInfo> getLinkedControls(Long id) {
        return resolveControls(find(id).getObligationId());
    }

    /** Streams the PDF of the obligation's source instrument (404 DOCUMENT_UNAVAILABLE when none is stored). */
    public InputStream openPdfStream(Long id) throws IOException {
        return browserService.openPdfStream(find(id).getInstrumentId());
    }

    private ObligationMapping find(Long id) {
        return obligationRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Obligation not found: " + id));
    }

    // ------------------------------------------------------------------ helpers

    private Map<Long, Instrument> instrumentsFor(List<ObligationMapping> rows) {
        Set<Long> ids = rows.stream().map(ObligationMapping::getInstrumentId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return instrumentRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(Instrument::getInstrumentId, x -> x, (a, b) -> a));
    }

    private Map<Long, Regulation> regulationsFor(List<ObligationMapping> rows) {
        Set<Long> ids = rows.stream().map(ObligationMapping::getRegulationId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return regulationRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(Regulation::getRegulationId, x -> x, (a, b) -> a));
    }

    private Map<Integer, Regulator> regulatorsFor(Collection<Instrument> insts, Collection<Regulation> regs) {
        Set<Integer> ids = new HashSet<>();
        insts.stream().map(Instrument::getRegulatorId).filter(Objects::nonNull).forEach(ids::add);
        regs.stream().map(Regulation::getRegulatorId).filter(Objects::nonNull).forEach(ids::add);
        if (ids.isEmpty()) return Map.of();
        return regulatorRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(Regulator::getRegulatorId, x -> x, (a, b) -> a));
    }

    private static Regulator resolveRegulator(Instrument inst, Regulation reg, Map<Integer, Regulator> regulatorMap) {
        Regulator regulator = null;
        if (inst != null && inst.getRegulatorId() != null) regulator = regulatorMap.get(inst.getRegulatorId());
        if (regulator == null && reg != null && reg.getRegulatorId() != null) regulator = regulatorMap.get(reg.getRegulatorId());
        return regulator;
    }

    private ObligationExplorerItem toItem(ObligationMapping ob,
                                          Map<Long, Instrument> instrumentMap,
                                          Map<Long, Regulation> regulationMap,
                                          Map<Integer, Regulator> regulatorMap) {
        Instrument inst = ob.getInstrumentId() != null ? instrumentMap.get(ob.getInstrumentId()) : null;
        Regulation reg = ob.getRegulationId() != null ? regulationMap.get(ob.getRegulationId()) : null;
        Regulator regulator = resolveRegulator(inst, reg, regulatorMap);

        return ObligationExplorerItem.builder()
                .obligationId(ob.getObligationId())
                .obligationNumber(ob.getObligationNumber())
                .title(ob.getTitle())
                .description(ob.getDescription())
                .plainEnglishStatement(ob.getPlainEnglishStatement())
                .sectionReference(ob.getSpecificSectionReference())
                .areaOfFocus(ob.getAreaOfFocus())
                .obligationType(ob.getObligationType())
                .recurringDeadlineType(ob.getRecurringDeadlineType())
                .riskRating(ob.getInherentRiskRating())
                .inherentLikelihood(ob.getInherentLikelihood())
                .inherentImpact(ob.getInherentImpact())
                .riskDescription(ob.getRiskDescription())
                .regulatorId(regulator != null ? regulator.getRegulatorId() : null)
                .regulatorAbbreviation(regulator != null ? regulator.getAbbreviation() : null)
                .actId(ob.getRegulationId())
                .actName(reg != null ? reg.getName() : null)
                .instrumentId(ob.getInstrumentId())
                .instrumentTitle(inst != null ? inst.getSourceTitle() : null)
                .hasPoints(ob.getPoints() != null && !ob.getPoints().isEmpty())
                .build();
    }

    private List<ObligationExplorerDetail.SanctionInfo> resolveSanctions(ObligationMapping ob) {
        Map<Long, SanctionsPenalty> raw = new LinkedHashMap<>();
        if (ob.getInstrumentId() != null) {
            sanctionsRepo.findByInstrumentId(ob.getInstrumentId()).forEach(s -> raw.putIfAbsent(s.getSanctionId(), s));
        }
        if (ob.getRegulationId() != null) {
            sanctionsRepo.findByRegulationId(ob.getRegulationId()).forEach(s -> raw.putIfAbsent(s.getSanctionId(), s));
        }
        return raw.values().stream()
                .map(s -> ObligationExplorerDetail.SanctionInfo.builder()
                        .sanctionId(s.getSanctionId())
                        .sanctionType(s.getSanctionType())
                        .sanctionAmountNaira(s.getSanctionAmountNaira())
                        .sanctionAmountPerDay(s.getSanctionAmountPerDay())
                        .liableRoles(s.getLiableRoles())
                        .description(s.getDescription())
                        .sectionReference(s.getSourceSectionReference())
                        .riskExplanation(s.getRiskExplanation())
                        .penaltyDetails(s.getPenaltyDetails())
                        .build())
                .toList();
    }

    private List<ObligationExplorerDetail.ReturnInfo> resolveReturns(ObligationMapping ob) {
        if (ob.getRegulationId() == null) return List.of();
        List<RegulatoryReturn> rets = returnRepo.findByActId(ob.getRegulationId());
        return rets.stream()
                .map(r -> ObligationExplorerDetail.ReturnInfo.builder()
                        .returnId(r.getReturnId())
                        .title(r.getTitle())
                        .sectionReference(r.getSectionReference())
                        .statutoryBasis(r.getStatutoryBasis())
                        .responsibleUnit(r.getResponsibleUnit())
                        .responsiblePerson(r.getResponsiblePerson())
                        .frequency(r.getFrequency())
                        .deadline(r.getDeadline())
                        .build())
                .toList();
    }

    private List<ObligationExplorerDetail.ControlInfo> resolveControls(Long obligationId) {
        if (obligationId == null) return List.of();
        // Two link styles: the foreign-key column obligation_id (monitoring-plan imports) AND the
        // comma-separated linked_obligation_ids on the control row (toolkit CRMP imports). Union
        // both, deduped by control id, so controls created either way show on the obligation.
        Map<Long, ComplianceControl> merged = new LinkedHashMap<>();
        controlRepo.findByObligationId(obligationId)
            .forEach(cc -> merged.putIfAbsent(cc.getComplianceControlId(), cc));
        controlRepo.findByLinkedObligationId(obligationId)
            .forEach(cc -> merged.putIfAbsent(cc.getComplianceControlId(), cc));
        return merged.values().stream()
                .map(cc -> ObligationExplorerDetail.ControlInfo.builder()
                        .controlId(cc.getComplianceControlId())
                        .name(cc.getControlNumber())
                        .description(cc.getRegulatoryRequirement())
                        .controlType(cc.getControlType())
                        .controlOwnerName(cc.getOwnerName())
                        .testFrequency(cc.getFrequency())
                        .status(cc.getStatus())
                        .theme(cc.getTheme())
                        .controlNumber(cc.getControlNumber())
                        .build())
                .toList();
    }

    private static Predicate likeLower(CriteriaBuilder cb, Expression<String> path, String like) {
        return cb.like(cb.lower(path), like);
    }

    private static Predicate eqLower(CriteriaBuilder cb, Expression<String> path, String value) {
        return cb.equal(cb.lower(path), value.trim().toLowerCase());
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
