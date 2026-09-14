package com.atheris.compliance.intelligence.backend.modules.obligations.service;

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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class ObligationExplorerService {

    private final ObligationMappingRepository obligationRepo;
    private final InstrumentRepository instrumentRepo;
    private final RegulationRepository regulationRepo;
    private final RegulatorRepository regulatorRepo;
    private final SanctionsRepository sanctionsRepo;
    private final RegulatoryReturnRepository returnRepo;
    private final ComplianceControlRepository controlRepo;

    public Page<ObligationExplorerItem> list(
            String q,
            String risk,
            Integer regulatorId,
            String areaOfFocus,
            Long actId,
            Boolean hasPoints,
            Pageable pageable) {

        List<ObligationMapping> all = obligationRepo.findAll();

        Map<Long, Instrument> instrumentMap = buildInstrumentMap(all);
        Map<Long, Regulation> regulationMap = buildRegulationMap(all);
        Map<Integer, Regulator> regulatorMap = buildRegulatorMap();

        List<ObligationExplorerItem> enriched = all.stream()
                .map(ob -> toItem(ob, instrumentMap, regulationMap, regulatorMap))
                .filter(item -> matches(item, obForItem(all, item), q, risk, regulatorId, areaOfFocus, actId, hasPoints, instrumentMap))
                .sorted(comparator(pageable))
                .toList();

        int total = enriched.size();
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), total);
        List<ObligationExplorerItem> page = start >= total ? List.of() : enriched.subList(start, end);
        return new PageImpl<>(page, pageable, total);
    }

    public ObligationExplorerStats getStats() {
        List<ObligationMapping> all = obligationRepo.findAll();
        Map<Long, Instrument> instrumentMap = buildInstrumentMap(all);
        Map<Long, Regulation> regulationMap = buildRegulationMap(all);
        Map<Integer, Regulator> regulatorMap = buildRegulatorMap();

        List<ObligationExplorerItem> items = all.stream()
                .map(ob -> toItem(ob, instrumentMap, regulationMap, regulatorMap))
                .toList();

        long total = items.size();
        long withPoints = items.stream().filter(i -> Boolean.TRUE.equals(i.getHasPoints())).count();
        long withoutPoints = total - withPoints;
        long highRisk = items.stream()
                .filter(i -> isHighRisk(i.getRiskRating()))
                .count();

        List<String> regulators = items.stream()
                .map(ObligationExplorerItem::getRegulatorAbbreviation)
                .filter(Objects::nonNull).filter(s -> !s.isBlank())
                .collect(Collectors.toCollection(TreeSet::new))
                .stream().toList();
        List<String> areas = items.stream()
                .map(ObligationExplorerItem::getAreaOfFocus)
                .filter(Objects::nonNull).filter(s -> !s.isBlank())
                .collect(Collectors.toCollection(TreeSet::new))
                .stream().toList();
        List<String> risks = items.stream()
                .map(ObligationExplorerItem::getRiskRating)
                .filter(Objects::nonNull).filter(s -> !s.isBlank())
                .collect(Collectors.toCollection(TreeSet::new))
                .stream().toList();
        List<String> acts = items.stream()
                .map(ObligationExplorerItem::getActName)
                .filter(Objects::nonNull).filter(s -> !s.isBlank())
                .collect(Collectors.toCollection(TreeSet::new))
                .stream().toList();

        return ObligationExplorerStats.builder()
                .total(total)
                .highRisk(highRisk)
                .withPoints(withPoints)
                .withoutPoints(withoutPoints)
                .regulators(regulators)
                .areas(areas)
                .risks(risks)
                .acts(acts)
                .build();
    }

    public ObligationExplorerDetail getDetail(Long id) {
        ObligationMapping ob = obligationRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Obligation not found: " + id));

        Map<Long, Instrument> instrumentMap = ob.getInstrumentId() != null
                ? instrumentRepo.findAllById(Set.of(ob.getInstrumentId())).stream()
                    .collect(Collectors.toMap(Instrument::getInstrumentId, x -> x, (a, b) -> a))
                : Map.of();
        Map<Long, Regulation> regulationMap = ob.getRegulationId() != null
                ? regulationRepo.findAllById(Set.of(ob.getRegulationId())).stream()
                    .collect(Collectors.toMap(Regulation::getRegulationId, x -> x, (a, b) -> a))
                : Map.of();
        Map<Integer, Regulator> regulatorMap = buildRegulatorMap();

        Instrument inst = ob.getInstrumentId() != null ? instrumentMap.get(ob.getInstrumentId()) : null;
        Regulation reg = ob.getRegulationId() != null ? regulationMap.get(ob.getRegulationId()) : null;
        Regulator regulator = null;
        if (inst != null && inst.getRegulatorId() != null) {
            regulator = regulatorMap.get(inst.getRegulatorId());
        }
        if (regulator == null && reg != null && reg.getRegulatorId() != null) {
            regulator = regulatorMap.get(reg.getRegulatorId());
        }

        String regulatorAbbr = regulator != null ? regulator.getAbbreviation() : null;
        String regulatorName = regulator != null ? regulator.getName() : null;
        Integer resolvedRegulatorId = regulator != null ? regulator.getRegulatorId() : (inst != null ? inst.getRegulatorId() : null);
        String actName = reg != null ? reg.getName() : null;
        String instrumentTitle = inst != null ? inst.getSourceTitle() : null;
        boolean hasPts = ob.getPoints() != null && !ob.getPoints().isEmpty();

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

        List<ObligationExplorerDetail.SanctionInfo> sanctions = resolveSanctions(ob, inst);
        List<ObligationExplorerDetail.ReturnInfo> returns = resolveReturns(ob);

        boolean hasGap = ob.getControlOwner() == null || ob.getControlOwner().isBlank();
        String gapDescription = hasGap ? ob.getRiskDescription() : null;
        String applicability = ob.getInherentRiskRating() != null ? "applicable" : null;
        String applicabilityReasoning = ob.getInherentRiskRating() != null
                ? "Obligation has been assessed with inherent risk rating: " + ob.getInherentRiskRating()
                : null;
        String classifiedByName = ob.getControlOwner();
        Instant classifiedAt = ob.getCreatedAt();
        String assignedOwnerName = ob.getControlOwner();
        String assignedDepartment = ob.getAreaOfFocus();

        List<ObligationExplorerDetail.ControlInfo> linkedControls = resolveControls(ob);
        List<ObligationExplorerDetail.EvidenceInfo> evidence = List.of();
        List<ObligationExplorerDetail.HistoryEntry> history = List.of();

        return ObligationExplorerDetail.builder()
                .obligationId(ob.getObligationId())
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
                .gapDescription(gapDescription)
                .applicability(applicability)
                .applicabilityReasoning(applicabilityReasoning)
                .classifiedByName(classifiedByName)
                .classifiedAt(classifiedAt)
                .assignedOwnerName(assignedOwnerName)
                .assignedDepartment(assignedDepartment)
                .linkedControls(linkedControls)
                .evidence(evidence)
                .history(history)
                .regulatorAbbreviation(regulatorAbbr)
                .regulatorName(regulatorName)
                .regulatorId(resolvedRegulatorId)
                .actName(actName)
                .actId(ob.getRegulationId())
                .instrumentTitle(instrumentTitle)
                .instrumentId(ob.getInstrumentId())
                .hasPoints(hasPts)
                .points(ob.getPoints() != null ? ob.getPoints() : List.of())
                .createdAt(ob.getCreatedAt())
                .instrument(instrumentInfo)
                .sanctions(sanctions)
                .returns(returns)
                .build();
    }

    // ------------------------------------------------------------------ helpers

    private Map<Long, Instrument> buildInstrumentMap(List<ObligationMapping> all) {
        Set<Long> ids = all.stream().map(ObligationMapping::getInstrumentId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return instrumentRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(Instrument::getInstrumentId, x -> x, (a, b) -> a));
    }

    private Map<Long, Regulation> buildRegulationMap(List<ObligationMapping> all) {
        Set<Long> ids = all.stream().map(ObligationMapping::getRegulationId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return regulationRepo.findAllById(ids).stream()
                .collect(Collectors.toMap(Regulation::getRegulationId, x -> x, (a, b) -> a));
    }

    private Map<Integer, Regulator> buildRegulatorMap() {
        return regulatorRepo.findAll().stream()
                .collect(Collectors.toMap(Regulator::getRegulatorId, x -> x, (a, b) -> a));
    }

    private ObligationExplorerItem toItem(ObligationMapping ob,
                                          Map<Long, Instrument> instrumentMap,
                                          Map<Long, Regulation> regulationMap,
                                          Map<Integer, Regulator> regulatorMap) {
        Instrument inst = ob.getInstrumentId() != null ? instrumentMap.get(ob.getInstrumentId()) : null;
        Regulation reg = ob.getRegulationId() != null ? regulationMap.get(ob.getRegulationId()) : null;
        Regulator regulator = null;
        if (inst != null && inst.getRegulatorId() != null) regulator = regulatorMap.get(inst.getRegulatorId());
        if (regulator == null && reg != null && reg.getRegulatorId() != null) regulator = regulatorMap.get(reg.getRegulatorId());

        return ObligationExplorerItem.builder()
                .obligationId(ob.getObligationId())
                .title(ob.getTitle())
                .description(ob.getDescription())
                .plainEnglishStatement(ob.getPlainEnglishStatement())
                .sectionReference(ob.getSpecificSectionReference())
                .areaOfFocus(ob.getAreaOfFocus())
                .obligationType(ob.getObligationType())
                .riskRating(ob.getInherentRiskRating())
                .riskDescription(ob.getRiskDescription())
                .regulatorAbbreviation(regulator != null ? regulator.getAbbreviation() : null)
                .actName(reg != null ? reg.getName() : null)
                .instrumentTitle(inst != null ? inst.getSourceTitle() : null)
                .hasPoints(ob.getPoints() != null && !ob.getPoints().isEmpty())
                .build();
    }

    // lookup obligation for filtering hasPoints edge: we already have hasPoints in item
    private ObligationMapping obForItem(List<ObligationMapping> all, ObligationExplorerItem item) {
        // find by id; all is small so linear search is ok
        for (ObligationMapping ob : all) {
            if (ob.getObligationId().equals(item.getObligationId())) return ob;
        }
        return null;
    }

    private boolean matches(ObligationExplorerItem item,
                            ObligationMapping ob,
                            String q, String risk,
                            Integer regulatorId, String areaOfFocus,
                            Long actId, Boolean hasPoints,
                            Map<Long, Instrument> instrumentMap) {
        if (risk != null && !risk.isBlank() && !risk.equalsIgnoreCase(item.getRiskRating())) return false;
        if (areaOfFocus != null && !areaOfFocus.isBlank() && !areaOfFocus.equalsIgnoreCase(item.getAreaOfFocus())) return false;
        if (actId != null && (ob == null || !actId.equals(ob.getRegulationId()))) return false;
        if (hasPoints != null && !hasPoints.equals(item.getHasPoints())) return false;
        if (regulatorId != null) {
            if (ob == null || ob.getInstrumentId() == null) return false;
            Instrument inst = instrumentMap.get(ob.getInstrumentId());
            if (inst == null || !regulatorId.equals(inst.getRegulatorId())) return false;
        }
        if (q != null && !q.isBlank()) {
            String needle = q.toLowerCase();
            boolean match = contains(item.getTitle(), needle)
                    || contains(item.getDescription(), needle)
                    || contains(item.getPlainEnglishStatement(), needle)
                    || contains(item.getSectionReference(), needle)
                    || contains(item.getAreaOfFocus(), needle)
                    || contains(item.getActName(), needle)
                    || contains(item.getInstrumentTitle(), needle)
                    || contains(item.getRegulatorAbbreviation(), needle)
                    || contains(item.getRiskRating(), needle);
            if (!match) return false;
        }
        return true;
    }

    private static boolean contains(String s, String needle) {
        return s != null && s.toLowerCase().contains(needle);
    }

    private static boolean isHighRisk(String risk) {
        if (risk == null) return false;
        String r = risk.toLowerCase();
        return r.equals("critical") || r.equals("high");
    }

    private Comparator<ObligationExplorerItem> comparator(Pageable pageable) {
        Sort sort = pageable.getSort();
        if (!sort.isSorted()) {
            return Comparator.comparing(ObligationExplorerItem::getObligationId, Comparator.nullsLast(Long::compareTo));
        }
        Sort.Order order = sort.iterator().next();
        String prop = order.getProperty();
        boolean asc = order.isAscending();
        Comparator<ObligationExplorerItem> cmp = switch (prop) {
            case "title" -> Comparator.comparing(i -> nullSafe(i.getTitle()), String.CASE_INSENSITIVE_ORDER);
            case "risk", "riskRating", "inherentRiskRating" -> riskComparator();
            case "areaOfFocus" -> Comparator.comparing(i -> nullSafe(i.getAreaOfFocus()), String.CASE_INSENSITIVE_ORDER);
            case "instrumentTitle" -> Comparator.comparing(i -> nullSafe(i.getInstrumentTitle()), String.CASE_INSENSITIVE_ORDER);
            case "obligationId", "id" -> Comparator.comparing(ObligationExplorerItem::getObligationId, Comparator.nullsLast(Long::compareTo));
            default -> Comparator.comparing(ObligationExplorerItem::getObligationId, Comparator.nullsLast(Long::compareTo));
        };
        return asc ? cmp : cmp.reversed();
    }

    private static Comparator<ObligationExplorerItem> riskComparator() {
        Map<String, Integer> order = Map.of(
                "critical", 4, "high", 3, "moderate", 2, "low", 1
        );
        return Comparator.comparingInt(i -> {
            String key = i.getRiskRating() != null ? i.getRiskRating().toLowerCase() : "";
            return order.getOrDefault(key, 0);
        });
    }

    private static String nullSafe(String s) { return s != null ? s : ""; }

    private List<ObligationExplorerDetail.SanctionInfo> resolveSanctions(ObligationMapping ob, Instrument inst) {
        List<SanctionsPenalty> raw = new ArrayList<>();
        if (inst != null && ob.getInstrumentId() != null) {
            raw.addAll(sanctionsRepo.findByInstrumentId(ob.getInstrumentId()));
        }
        if (ob.getRegulationId() != null) {
            List<SanctionsPenalty> byAct = sanctionsRepo.findByRegulationId(ob.getRegulationId());
            // dedup by sanctionId
            Set<Long> seen = raw.stream().map(SanctionsPenalty::getSanctionId).collect(Collectors.toSet());
            for (SanctionsPenalty s : byAct) {
                if (!seen.contains(s.getSanctionId())) raw.add(s);
            }
        }
        if (raw.isEmpty()) return List.of();
        return raw.stream()
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
        if (rets.isEmpty()) return List.of();
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

    private List<ObligationExplorerDetail.ControlInfo> resolveControls(ObligationMapping ob) {
        if (ob.getObligationId() == null) return List.of();
        List<ComplianceControl> controls = controlRepo.findByObligationId(ob.getObligationId());
        if (controls.isEmpty()) return List.of();
        return controls.stream()
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
}
