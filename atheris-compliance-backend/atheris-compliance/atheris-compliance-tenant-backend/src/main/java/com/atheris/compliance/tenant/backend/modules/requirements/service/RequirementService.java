package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.entity.ControlTestResult;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlTestResultRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.dto.RequirementDto;
import com.atheris.compliance.tenant.backend.modules.requirements.dto.RequirementRequest;
import com.atheris.compliance.tenant.backend.modules.requirements.dto.RequirementSummary;
import com.atheris.compliance.tenant.backend.modules.requirements.dto.StateOverrideRequest;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.RequirementControl;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementControlRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementRepository;
import com.atheris.compliance.tenant.backend.modules.risks.entity.Risk;
import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskObligation;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskObligationRepository;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class RequirementService {

    private static final Set<String> OVERRIDE_STATES =
        Set.of(ComplianceState.COMPLIANT, ComplianceState.PARTIAL, ComplianceState.NON_COMPLIANT);

    private final RequirementRepository requirements;
    private final RequirementControlRepository requirementControls;
    private final ObligationRepository obligations;
    private final ObligationClassificationRepository classifications;
    private final ControlRepository controls;
    private final ControlTestResultRepository testResults;
    private final RiskRepository risks;
    private final RiskObligationRepository riskObligations;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<RequirementDto> forObligation(Long obligationId) {
        if (!obligations.existsById(obligationId)) throw ApiException.notFound("Obligation not found: " + obligationId);
        return toDtos(requirements.findByObligationIdOrderByOrdinalAsc(obligationId));
    }

    @Transactional(readOnly = true)
    public RequirementDto detail(Long requirementId) {
        Requirement r = requirements.findById(requirementId)
            .orElseThrow(() -> ApiException.notFound("Requirement not found: " + requirementId));
        return toDtos(List.of(r)).get(0);
    }

    /** One batched pass over a page of obligations: no per-obligation queries. */
    @Transactional(readOnly = true)
    public Map<Long, RequirementSummary> summaries(Collection<Long> obligationIds) {
        if (obligationIds.isEmpty()) return Map.of();
        List<Requirement> reqs = requirements.findByObligationIdInOrderByObligationIdAscOrdinalAsc(obligationIds);
        Map<Long, String> stateById = states(reqs);
        Map<Long, List<Requirement>> byObligation = reqs.stream().collect(Collectors.groupingBy(Requirement::getObligationId));
        Map<Long, RequirementSummary> out = new HashMap<>();
        for (Long id : obligationIds) {
            List<Requirement> list = byObligation.getOrDefault(id, List.of());
            List<String> st = list.stream().map(r -> stateById.get(r.getRequirementId())).toList();
            int gaps = (int) st.stream().filter(ComplianceState::isGap).count();
            out.put(id, RequirementSummary.builder()
                .obligationId(id)
                .requirementCount(list.size())
                .gapCount(gaps)
                .coveredCount(list.size() - gaps)
                .state(ComplianceState.ofObligation(st))
                .hasGap(gaps > 0)
                .build());
        }
        return out;
    }

    @Transactional
    public RequirementDto create(RequirementRequest req, Integer userId) {
        if (req.getObligationId() == null) throw ApiException.badRequest("obligation_required", "obligationId is required");
        if (req.getText() == null || req.getText().isBlank()) throw ApiException.badRequest("text_required", "text is required");
        if (!obligations.existsById(req.getObligationId()))
            throw ApiException.notFound("Obligation not found: " + req.getObligationId());
        int next = requirements.findByObligationIdOrderByOrdinalAsc(req.getObligationId()).stream()
            .mapToInt(Requirement::getOrdinal).max().orElse(-1) + 1;
        Requirement saved = requirements.save(Requirement.builder()
            .obligationId(req.getObligationId())
            .ordinal(next)
            .text(req.getText().trim())
            .riskId(validRisk(req.getRiskId()))
            .source("manual")
            .build());
        if (req.getControlIds() != null) replaceControls(saved, req.getControlIds());
        syncObligationLinks(saved.getObligationId());
        linkRisk(saved);
        audit.log(userId, "requirement_created", "requirement", saved.getRequirementId(),
            Map.of("obligationId", saved.getObligationId()));
        return detail(saved.getRequirementId());
    }

    @Transactional
    public RequirementDto update(Long requirementId, RequirementRequest req, Integer userId) {
        Requirement r = requirements.findById(requirementId)
            .orElseThrow(() -> ApiException.notFound("Requirement not found: " + requirementId));
        if (req.getText() != null) {
            if (req.getText().isBlank()) throw ApiException.badRequest("text_required", "text must not be blank");
            r.setText(req.getText().trim());
        }
        if (req.getRiskId() != null) r.setRiskId(validRisk(req.getRiskId()));
        requirements.save(r);
        if (req.getControlIds() != null) replaceControls(r, req.getControlIds());
        syncObligationLinks(r.getObligationId());
        linkRisk(r);
        audit.log(userId, "requirement_updated", "requirement", requirementId, Map.of());
        return detail(requirementId);
    }

    @Transactional
    public void delete(Long requirementId, Integer userId) {
        Requirement r = requirements.findById(requirementId)
            .orElseThrow(() -> ApiException.notFound("Requirement not found: " + requirementId));
        requirementControls.deleteByRequirementId(requirementId);
        requirements.delete(r);
        syncObligationLinks(r.getObligationId());
        audit.log(userId, "requirement_deleted", "requirement", requirementId, Map.of("obligationId", r.getObligationId()));
    }

    @Transactional
    public RequirementDto setControls(Long requirementId, List<Integer> controlIds, Integer userId) {
        Requirement r = requirements.findById(requirementId)
            .orElseThrow(() -> ApiException.notFound("Requirement not found: " + requirementId));
        replaceControls(r, controlIds == null ? List.of() : controlIds);
        syncObligationLinks(r.getObligationId());
        audit.log(userId, "requirement_controls_set", "requirement", requirementId,
            Map.of("controlIds", controlIds == null ? List.of() : controlIds));
        return detail(requirementId);
    }

    @Transactional
    public RequirementDto setOverride(Long requirementId, StateOverrideRequest req, Integer userId) {
        Requirement r = requirements.findById(requirementId)
            .orElseThrow(() -> ApiException.notFound("Requirement not found: " + requirementId));
        String state = req.getState() == null ? "" : req.getState().trim().toUpperCase(Locale.ROOT);
        if (state.isEmpty()) {
            r.setStateOverride(null);
            r.setOverrideReason(null);
        } else {
            if (!OVERRIDE_STATES.contains(state))
                throw ApiException.badRequest("invalid_state", "state must be one of " + OVERRIDE_STATES);
            if (req.getReason() == null || req.getReason().isBlank())
                throw ApiException.badRequest("reason_required", "an override needs a reason");
            r.setStateOverride(state);
            r.setOverrideReason(req.getReason().trim());
        }
        requirements.save(r);
        audit.log(userId, "requirement_state_override", "requirement", requirementId,
            Map.of("state", state, "reason", req.getReason() == null ? "" : req.getReason()));
        return detail(requirementId);
    }

    /**
     * Keeps the legacy lists in step with requirement links: the classification's linkedControlIds
     * and each control's linkedObligationIds are the union over the obligation's requirements, so
     * the task centre, dashboards, findings and runbooks keep reading what they always read.
     */
    @Transactional
    public void syncObligationLinks(Long obligationId) {
        List<Requirement> reqs = requirements.findByObligationIdOrderByOrdinalAsc(obligationId);
        Set<Integer> union = reqs.isEmpty() ? Set.of()
            : requirementControls.findByRequirementIdIn(reqs.stream().map(Requirement::getRequirementId).toList()).stream()
                .map(RequirementControl::getControlId).collect(Collectors.toCollection(LinkedHashSet::new));

        classifications.findByObligationId(obligationId).ifPresent(c -> {
            Set<Integer> before = c.getLinkedControlIds() == null ? Set.of() : new HashSet<>(c.getLinkedControlIds());
            if (!before.equals(union)) {
                c.setLinkedControlIds(new ArrayList<>(union));
                classifications.save(c);
            }
            Set<Integer> affected = new HashSet<>(before);
            affected.addAll(union);
            if (affected.isEmpty()) return;
            List<Control> changed = new ArrayList<>();
            for (Control control : controls.findAllById(affected)) {
                List<Long> ids = control.getLinkedObligationIds() == null
                    ? new ArrayList<>() : new ArrayList<>(control.getLinkedObligationIds());
                boolean has = ids.contains(obligationId);
                boolean should = union.contains(control.getControlId());
                if (should && !has) { ids.add(obligationId); control.setLinkedObligationIds(ids); changed.add(control); }
                else if (!should && has) { ids.remove(obligationId); control.setLinkedObligationIds(ids); changed.add(control); }
            }
            controls.saveAll(changed);
        });
    }

    @Transactional
    public void replaceTexts(Long obligationId, List<String> texts, Integer userId) {
        if (!obligations.existsById(obligationId))
            throw ApiException.notFound("Obligation not found: " + obligationId);
        List<String> wanted = (texts == null ? List.<String>of() : texts).stream()
            .map(t -> t == null ? "" : t.trim())
            .filter(t -> !t.isBlank())
            .toList();
        Set<String> wantedSet = new LinkedHashSet<>(wanted);

        List<Requirement> existing = requirements.findByObligationIdOrderByOrdinalAsc(obligationId);
        Map<String, Requirement> kept = new LinkedHashMap<>();
        for (Requirement r : existing) {
            String key = r.getText() == null ? "" : r.getText().trim();
            if (wantedSet.contains(key) && !kept.containsKey(key)) kept.put(key, r);
        }

        for (Requirement r : existing) {
            String key = r.getText() == null ? "" : r.getText().trim();
            if (kept.get(key) != r) {
                requirementControls.deleteByRequirementId(r.getRequirementId());
                requirements.delete(r);
            }
        }
        requirements.flush();

        int ordinal = 0;
        for (String text : wanted) {
            Requirement r = kept.get(text);
            if (r == null) {
                requirements.save(Requirement.builder()
                    .obligationId(obligationId).ordinal(ordinal).text(text).source("manual").build());
            } else if (!Objects.equals(r.getOrdinal(), ordinal)) {
                r.setOrdinal(ordinal);
                requirements.save(r);
            }
            ordinal++;
        }
        syncObligationLinks(obligationId);
    }

    /**
     * The obligation-level control list (the older "link controls" action and the create/update
     * obligation dialogs) expressed as requirement links. With no requirements yet, one default
     * requirement is made from the obligation's own statement. With requirements, controls newly
     * added are attached to every requirement that has none (so the gap closes), and controls
     * removed are detached from all of them. Per-requirement links are never overwritten wholesale.
     */
    @Transactional
    public void applyObligationControls(Long obligationId, Collection<Integer> selected) {
        applyObligationControls(obligationId, null, selected);
    }

    public void applyObligationControls(Long obligationId, Collection<Long> requirementIds,
                                        Collection<Integer> selected) {
        Obligation ob = obligations.findById(obligationId)
            .orElseThrow(() -> ApiException.notFound("Obligation not found: " + obligationId));
        Set<Integer> wanted = new LinkedHashSet<>(selected == null ? List.of() : selected);
        List<Requirement> reqs = requirements.findByObligationIdOrderByOrdinalAsc(obligationId);
        if (reqs.isEmpty()) {
            if (wanted.isEmpty()) return;
            String text = ob.getPlainEnglishStatement() != null && !ob.getPlainEnglishStatement().isBlank()
                ? ob.getPlainEnglishStatement()
                : ob.getDescription() != null && !ob.getDescription().isBlank() ? ob.getDescription()
                : ob.getTitle() != null ? ob.getTitle() : ob.getName();
            if (text == null || text.isBlank()) return;
            Requirement def = requirements.save(Requirement.builder()
                .obligationId(obligationId).ordinal(0).text(text.trim()).source("manual").build());
            reqs = List.of(def);
        }

        if (requirementIds != null) {
            Set<Long> scope = new LinkedHashSet<>(requirementIds);
            for (Requirement r : reqs) {
                if (!scope.contains(r.getRequirementId())) continue;
                requirementControls.deleteByRequirementId(r.getRequirementId());
                requirementControls.flush();
                for (Integer id : wanted) {
                    requirementControls.save(new RequirementControl(r.getRequirementId(), id));
                }
            }
            syncObligationLinks(obligationId);
            return;
        }

        Map<Long, Set<Integer>> linked = requirementControls
            .findByRequirementIdIn(reqs.stream().map(Requirement::getRequirementId).toList()).stream()
            .collect(Collectors.groupingBy(RequirementControl::getRequirementId,
                Collectors.mapping(RequirementControl::getControlId, Collectors.toCollection(LinkedHashSet::new))));
        Set<Integer> current = linked.values().stream().flatMap(Set::stream).collect(Collectors.toSet());

        for (Requirement r : reqs) {
            Set<Integer> have = linked.getOrDefault(r.getRequirementId(), new LinkedHashSet<>());
            for (Integer id : new ArrayList<>(have)) {
                if (!wanted.contains(id)) requirementControls.delete(new RequirementControl(r.getRequirementId(), id));
            }
            if (have.isEmpty() || reqs.size() == 1) {
                for (Integer id : wanted) {
                    if (!current.contains(id) || reqs.size() == 1) {
                        if (!have.contains(id)) requirementControls.save(new RequirementControl(r.getRequirementId(), id));
                    }
                }
            }
        }
        syncObligationLinks(obligationId);
    }

    private void replaceControls(Requirement r, Collection<Integer> controlIds) {
        Set<Integer> wanted = new LinkedHashSet<>(controlIds);
        Set<Integer> existing = controls.findAllById(wanted).stream().map(Control::getControlId).collect(Collectors.toSet());
        if (!existing.containsAll(wanted)) throw ApiException.badRequest("unknown_control", "one or more controls do not exist");
        requirementControls.deleteByRequirementId(r.getRequirementId());
        requirementControls.flush();
        for (Integer id : wanted) requirementControls.save(new RequirementControl(r.getRequirementId(), id));
    }

    private Integer validRisk(Integer riskId) {
        if (riskId == null) return null;
        if (!risks.existsById(riskId)) throw ApiException.badRequest("unknown_risk", "risk does not exist: " + riskId);
        return riskId;
    }

    private void linkRisk(Requirement r) {
        if (r.getRiskId() == null) return;
        riskObligations.save(new RiskObligation(r.getRiskId(), r.getObligationId()));
    }

    private Map<Long, String> states(List<Requirement> reqs) {
        if (reqs.isEmpty()) return Map.of();
        Map<Long, List<Integer>> controlIdsByReq = requirementControls
            .findByRequirementIdIn(reqs.stream().map(Requirement::getRequirementId).toList()).stream()
            .collect(Collectors.groupingBy(RequirementControl::getRequirementId,
                Collectors.mapping(RequirementControl::getControlId, Collectors.toList())));
        Map<Integer, String> latest = latestResults(controlIdsByReq.values().stream().flatMap(List::stream).collect(Collectors.toSet()));
        Map<Long, String> out = new HashMap<>();
        for (Requirement r : reqs) {
            out.put(r.getRequirementId(), ComplianceState.ofRequirement(r, controlIdsByReq.get(r.getRequirementId()), latest));
        }
        return out;
    }

    private Map<Integer, String> latestResults(Collection<Integer> controlIds) {
        return latestTests(controlIds).entrySet().stream()
            .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().getResult()));
    }

    private Map<Integer, ControlTestResult> latestTests(Collection<Integer> controlIds) {
        if (controlIds.isEmpty()) return Map.of();
        Map<Integer, ControlTestResult> latest = new HashMap<>();
        for (ControlTestResult t : testResults.findByControlIdInOrderByTestDateDesc(controlIds)) {
            if (!com.atheris.compliance.tenant.backend.shared.util.WorkflowStatus.REVIEW_ACCEPTED.equals(t.getReviewStatus())) continue;
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

    private List<RequirementDto> toDtos(List<Requirement> reqs) {
        if (reqs.isEmpty()) return List.of();
        Map<Long, List<Integer>> controlIdsByReq = requirementControls
            .findByRequirementIdIn(reqs.stream().map(Requirement::getRequirementId).toList()).stream()
            .collect(Collectors.groupingBy(RequirementControl::getRequirementId,
                Collectors.mapping(RequirementControl::getControlId, Collectors.toList())));
        Set<Integer> allControlIds = controlIdsByReq.values().stream().flatMap(List::stream).collect(Collectors.toSet());
        Map<Integer, Control> controlById = allControlIds.isEmpty() ? Map.of()
            : controls.findAllById(allControlIds).stream().collect(Collectors.toMap(Control::getControlId, Function.identity()));
        Map<Integer, ControlTestResult> latest = latestTests(allControlIds);
        Map<Integer, String> latestResult = latest.entrySet().stream()
            .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().getResult()));

        Set<Integer> riskIds = reqs.stream().map(Requirement::getRiskId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Integer, Risk> riskById = riskIds.isEmpty() ? Map.of()
            : risks.findByRiskIdIn(riskIds).stream().collect(Collectors.toMap(Risk::getRiskId, Function.identity()));
        Set<Long> obligationIds = reqs.stream().map(Requirement::getObligationId).collect(Collectors.toSet());
        Map<Long, Obligation> obligationById = obligations.findAllById(obligationIds).stream()
            .collect(Collectors.toMap(Obligation::getObligationId, Function.identity()));

        List<RequirementDto> out = new ArrayList<>();
        for (Requirement r : reqs) {
            List<Integer> ids = controlIdsByReq.getOrDefault(r.getRequirementId(), List.of());
            String state = ComplianceState.ofRequirement(r, ids, latestResult);
            Risk risk = r.getRiskId() == null ? null : riskById.get(r.getRiskId());
            Obligation ob = obligationById.get(r.getObligationId());
            out.add(RequirementDto.builder()
                .requirementId(r.getRequirementId())
                .obligationId(r.getObligationId())
                .obligationTitle(ob == null ? null : (ob.getTitle() != null ? ob.getTitle() : ob.getName()))
                .actName(ob == null ? null : ob.getActName())
                .ordinal(r.getOrdinal())
                .text(r.getText())
                .state(state)
                .gap(ComplianceState.isGap(state))
                .stateOverride(r.getStateOverride())
                .overrideReason(r.getOverrideReason())
                .riskId(r.getRiskId())
                .riskCode(risk == null ? null : risk.getRiskCode())
                .riskName(risk == null ? null : risk.getName())
                .riskBand(risk == null ? null : risk.getInherentBand())
                .source(r.getSource())
                .controls(ids.stream().map(controlById::get).filter(Objects::nonNull).map(c -> {
                    ControlTestResult t = latest.get(c.getControlId());
                    return RequirementDto.ControlRef.builder()
                        .controlId(c.getControlId())
                        .controlNumber(c.getControlNumber())
                        .name(c.getName())
                        .latestResult(t == null ? null : t.getResult())
                        .latestTestDate(t == null ? null : t.getTestDate())
                        .effective(t != null && ComplianceState.effective(t.getResult()))
                        .build();
                }).toList())
                .updatedAt(r.getUpdatedAt())
                .build());
        }
        return out;
    }
}
