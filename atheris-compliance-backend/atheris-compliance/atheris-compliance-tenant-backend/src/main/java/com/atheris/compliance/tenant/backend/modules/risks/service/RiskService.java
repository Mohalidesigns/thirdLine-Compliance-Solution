package com.atheris.compliance.tenant.backend.modules.risks.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.RequirementControl;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementControlRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.service.ComplianceState;
import com.atheris.compliance.tenant.backend.modules.risks.dto.CreateRiskRequest;
import com.atheris.compliance.tenant.backend.modules.risks.dto.RiskItem;
import com.atheris.compliance.tenant.backend.modules.risks.dto.RiskStats;
import com.atheris.compliance.tenant.backend.modules.risks.entity.Risk;
import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskControl;
import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskObligation;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskControlRepository;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskObligationRepository;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class RiskService {

    private final RiskRepository risks;
    private final RiskObligationRepository riskObligations;
    private final RiskControlRepository riskControls;
    private final RequirementRepository requirements;
    private final RequirementControlRepository requirementControls;
    private final ObligationRepository obligations;
    private final ControlRepository controls;
    private final ControlTestResultRepository testResults;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<RiskItem> register(String q, String band, String status) {
        List<Risk> all = risks.findAll(Specification.where(matches(q, band, status)));
        all.sort(Comparator.comparing(Risk::getRiskCode, Comparator.nullsLast(String::compareTo)));
        Map<Integer, List<RiskItem.ObligationRef>> obligationsByRisk = obligationsByRisk(all);
        Map<Integer, List<RiskItem.ControlRef>> controlsByRisk = controlsByRisk(all);
        Map<Integer, Integer> requirementCounts = requirementCounts(all);
        Map<Integer, Integer> uncoveredCounts = uncoveredCounts(all);

        return all.stream().map(r -> toItem(r,
            obligationsByRisk.getOrDefault(r.getRiskId(), List.of()),
            controlsByRisk.getOrDefault(r.getRiskId(), List.of()),
            requirementCounts.getOrDefault(r.getRiskId(), 0),
            uncoveredCounts.getOrDefault(r.getRiskId(), 0))).toList();
    }

    @Transactional(readOnly = true)
    public RiskItem detail(Integer riskId) {
        Risk r = risks.findById(riskId)
            .orElseThrow(() -> ApiException.notFound("Risk not found: " + riskId));
        return toItem(r,
            obligationsByRisk(List.of(r)).getOrDefault(riskId, List.of()),
            controlsByRisk(List.of(r)).getOrDefault(riskId, List.of()),
            requirementCounts(List.of(r)).getOrDefault(riskId, 0),
            uncoveredCounts(List.of(r)).getOrDefault(riskId, 0));
    }

    @Transactional
    public RiskItem create(CreateRiskRequest req, Integer userId) {
        if (req.getName() == null || req.getName().isBlank())
            throw ApiException.badRequest("name_required", "name is required");

        List<Long> obligationIds = req.getObligationIds() == null ? List.of() : req.getObligationIds();
        Set<Long> known = obligationIds.isEmpty() ? Set.of()
            : obligations.findAllById(obligationIds).stream().map(Obligation::getObligationId).collect(Collectors.toSet());
        if (!known.containsAll(obligationIds))
            throw ApiException.badRequest("unknown_obligation", "one or more obligations do not exist");

        List<Integer> controlIds = req.getControlIds() == null ? List.of() : req.getControlIds();
        Set<Integer> knownControls = controlIds.isEmpty() ? Set.of()
            : controls.findAllById(controlIds).stream().map(Control::getControlId).collect(Collectors.toSet());
        if (!knownControls.containsAll(controlIds))
            throw ApiException.badRequest("unknown_control", "one or more controls do not exist");

        Risk risk = Risk.builder()
            .riskCode(nextCode())
            .name(req.getName().trim())
            .description(req.getDescription())
            .riskType(req.getRiskType())
            .areaOfFocus(req.getAreaOfFocus())
            .source("manual")
            .build();
        RiskScoring.apply(risk, obligations.findAllById(obligationIds));
        Risk saved = risks.save(risk);

        for (Long obligationId : new LinkedHashSet<>(obligationIds))
            riskObligations.save(new RiskObligation(saved.getRiskId(), obligationId));
        for (Integer controlId : new LinkedHashSet<>(controlIds))
            riskControls.save(new RiskControl(saved.getRiskId(), controlId));

        audit.log(userId, "risk_created", "risk", saved.getRiskId().longValue(),
            Map.of("obligations", obligationIds.size(), "controls", controlIds.size()));
        return detail(saved.getRiskId());
    }

    private String nextCode() {
        int max = risks.findAll().stream()
            .map(Risk::getRiskCode)
            .filter(c -> c != null && c.startsWith("RISK-"))
            .mapToInt(c -> {
                try { return Integer.parseInt(c.substring(5)); } catch (NumberFormatException e) { return 0; }
            })
            .max().orElse(0);
        return String.format("RISK-%04d", max + 1);
    }

    @Transactional(readOnly = true)
    public RiskStats stats() {
        List<Risk> all = risks.findAll();
        Map<String, Long> byBand = all.stream().collect(Collectors.groupingBy(
            r -> r.getInherentBand() == null ? "Unrated" : r.getInherentBand(),
            Collectors.counting()));
        Set<Integer> withControls = riskControls.findAll().stream().map(RiskControl::getRiskId).collect(Collectors.toSet());
        long active = all.stream().filter(r -> r.getStatus() == null || "Active".equalsIgnoreCase(r.getStatus())).count();
        long unmanaged = all.stream().filter(r -> !withControls.contains(r.getRiskId())).count();
        return RiskStats.builder().total(all.size()).active(active).byBand(byBand).unmanaged(unmanaged).build();
    }

    private Specification<Risk> matches(String q, String band, String status) {
        return (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                ps.add(cb.or(cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(root.get("riskCode")), like),
                    cb.like(cb.lower(root.get("areaOfFocus")), like)));
            }
            if (band != null && !band.isBlank()) ps.add(cb.equal(root.get("inherentBand"), band));
            if (status != null && !status.isBlank()) ps.add(cb.equal(root.get("status"), status));
            return ps.isEmpty() ? cb.conjunction() : cb.and(ps.toArray(new Predicate[0]));
        };
    }

    private Map<Integer, List<RiskItem.ObligationRef>> obligationsByRisk(List<Risk> forRisks) {
        if (forRisks.isEmpty()) return Map.of();
        Map<Integer, List<Long>> idsByRisk = riskObligations
            .findByRiskIdIn(forRisks.stream().map(Risk::getRiskId).toList()).stream()
            .collect(Collectors.groupingBy(RiskObligation::getRiskId,
                Collectors.mapping(RiskObligation::getObligationId, Collectors.toList())));
        Set<Long> obligationIds = idsByRisk.values().stream().flatMap(List::stream).collect(Collectors.toSet());
        if (obligationIds.isEmpty()) return Map.of();
        Map<Long, Obligation> byId = obligations.findAllById(obligationIds).stream()
            .collect(Collectors.toMap(Obligation::getObligationId, o -> o));
        Map<Integer, List<RiskItem.ObligationRef>> out = new HashMap<>();
        idsByRisk.forEach((riskId, ids) -> out.put(riskId, ids.stream().map(byId::get).filter(Objects::nonNull)
            .map(o -> RiskItem.ObligationRef.builder()
                .obligationId(o.getObligationId())
                .title(o.getTitle() != null && !o.getTitle().isBlank() ? o.getTitle() : o.getName())
                .actName(o.getActName())
                .build()).toList()));
        return out;
    }

    private Map<Integer, Integer> requirementCounts(List<Risk> forRisks) {
        if (forRisks.isEmpty()) return Map.of();
        Map<Long, Integer> obligationToRisk = riskObligations
            .findByRiskIdIn(forRisks.stream().map(Risk::getRiskId).toList()).stream()
            .collect(Collectors.toMap(RiskObligation::getObligationId, RiskObligation::getRiskId, (a, b) -> a));
        if (obligationToRisk.isEmpty()) return Map.of();
        Map<Integer, Integer> counts = new HashMap<>();
        for (Requirement req : requirements.findByObligationIdInOrderByObligationIdAscOrdinalAsc(obligationToRisk.keySet())) {
            Integer riskId = obligationToRisk.get(req.getObligationId());
            counts.merge(riskId, 1, Integer::sum);
        }
        return counts;
    }

    /** Requirements belonging to a risk's obligations that no linked control covers. */
    private Map<Integer, Integer> uncoveredCounts(List<Risk> forRisks) {
        if (forRisks.isEmpty()) return Map.of();
        Map<Integer, List<Long>> obligationIdsByRisk = riskObligations
            .findByRiskIdIn(forRisks.stream().map(Risk::getRiskId).toList()).stream()
            .collect(Collectors.groupingBy(RiskObligation::getRiskId,
                Collectors.mapping(RiskObligation::getObligationId, Collectors.toList())));
        Map<Long, Integer> obligationToRisk = new HashMap<>();
        obligationIdsByRisk.forEach((riskId, ids) -> ids.forEach(id -> obligationToRisk.put(id, riskId)));
        if (obligationToRisk.isEmpty()) return Map.of();
        List<Requirement> reqs = requirements.findByObligationIdInOrderByObligationIdAscOrdinalAsc(obligationToRisk.keySet());
        Map<Long, Integer> coverageByReq = requirementControls
            .findByRequirementIdIn(reqs.stream().map(Requirement::getRequirementId).toList()).stream()
            .collect(Collectors.toMap(RequirementControl::getRequirementId, c -> 1, Integer::sum));
        Map<Integer, Integer> uncovered = new HashMap<>();
        for (Requirement r : reqs) {
            if (coverageByReq.getOrDefault(r.getRequirementId(), 0) == 0) {
                uncovered.merge(obligationToRisk.get(r.getObligationId()), 1, Integer::sum);
            }
        }
        return uncovered;
    }

    private Map<Integer, List<RiskItem.ControlRef>> controlsByRisk(List<Risk> forRisks) {
        if (forRisks.isEmpty()) return Map.of();
        Map<Integer, List<Integer>> idsByRisk = riskControls
            .findByRiskIdIn(forRisks.stream().map(Risk::getRiskId).toList()).stream()
            .collect(Collectors.groupingBy(RiskControl::getRiskId,
                Collectors.mapping(RiskControl::getControlId, Collectors.toList())));
        Set<Integer> controlIds = idsByRisk.values().stream().flatMap(List::stream).collect(Collectors.toSet());
        if (controlIds.isEmpty()) return Map.of();
        Map<Integer, Control> byId = controls.findAllById(controlIds).stream()
            .collect(Collectors.toMap(Control::getControlId, c -> c));
        Map<Integer, ControlTestResult> latest = latestTests(controlIds);
        Map<Integer, List<RiskItem.ControlRef>> out = new HashMap<>();
        idsByRisk.forEach((riskId, ids) -> out.put(riskId, ids.stream().map(byId::get).filter(Objects::nonNull)
            .map(c -> {
                ControlTestResult t = latest.get(c.getControlId());
                return RiskItem.ControlRef.builder()
                    .controlId(c.getControlId())
                    .controlNumber(c.getControlNumber())
                    .name(c.getName())
                    .latestResult(t == null ? null : t.getResult())
                    .latestTestDate(t == null ? null : t.getTestDate())
                    .effective(t != null && ComplianceState.effective(t.getResult()))
                    .build();
            }).toList()));
        return out;
    }

    private Map<Integer, ControlTestResult> latestTests(Collection<Integer> controlIds) {
        if (controlIds.isEmpty()) return Map.of();
        Map<Integer, ControlTestResult> latest = new HashMap<>();
        for (ControlTestResult t : testResults.findByControlIdInOrderByTestDateDesc(controlIds)) {
            ControlTestResult cur = latest.get(t.getControlId());
            if (cur == null || isLater(t, cur)) latest.put(t.getControlId(), t);
        }
        return latest;
    }

    private static boolean isLater(ControlTestResult a, ControlTestResult b) {
        LocalDate da = a.getTestDate(), db = b.getTestDate();
        if (da != null && db != null && !da.equals(db)) return da.isAfter(db);
        if (da != null && db == null) return true;
        if (da == null && db != null) return false;
        return a.getTestId() != null && b.getTestId() != null && a.getTestId() > b.getTestId();
    }

    private RiskItem toItem(Risk r, List<RiskItem.ObligationRef> obligationRefs, List<RiskItem.ControlRef> controlRefs,
                            int requirementCount, int uncovered) {
        return RiskItem.builder()
            .riskId(r.getRiskId())
            .riskCode(r.getRiskCode())
            .name(r.getName())
            .description(r.getDescription())
            .riskType(r.getRiskType())
            .areaOfFocus(r.getAreaOfFocus())
            .inherentLikelihood(r.getInherentLikelihood())
            .inherentImpact(r.getInherentImpact())
            .inherentBand(r.getInherentBand() == null ? "Unrated" : r.getInherentBand())
            .status(r.getStatus())
            .obligationCount(obligationRefs.size())
            .requirementCount(requirementCount)
            .controlCount(controlRefs.size())
            .uncoveredRequirementCount(uncovered)
            .obligations(obligationRefs)
            .controls(controlRefs)
            .build();
    }
}
