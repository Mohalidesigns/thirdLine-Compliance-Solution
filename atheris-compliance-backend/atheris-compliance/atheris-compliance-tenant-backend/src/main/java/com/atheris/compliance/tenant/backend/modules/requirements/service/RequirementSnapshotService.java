package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.common.obligations.ObligationKey;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.Obligation;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.RequirementControl;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementControlRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementRepository;
import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskObligation;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskObligationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Review "Edit & Save" deletes and recreates an instrument's obligations, which would cascade-delete
 * every requirement and its control links. The snapshot keeps them, keyed by the obligation's
 * natural key, and {@link #restore} re-attaches them to the recreated obligations.
 */
@Service @RequiredArgsConstructor
public class RequirementSnapshotService {

    private final RequirementRepository requirements;
    private final RequirementControlRepository requirementControls;
    private final RiskObligationRepository riskObligations;

    public record Snapshot(Map<String, List<Entry>> byKey, Map<String, List<Integer>> riskIdsByKey) {
        public static Snapshot empty() { return new Snapshot(Map.of(), Map.of()); }
    }

    public record Entry(Integer ordinal, String text, Integer riskId, String stateOverride, String overrideReason,
                        String source, List<Integer> controlIds) {}

    public static String key(Obligation o) {
        return ObligationKey.of(o.getTitle(), o.getSectionReference(), o.getDescription(), o.getPlainEnglishStatement());
    }

    public Snapshot capture(Collection<Obligation> obligations) {
        if (obligations.isEmpty()) return Snapshot.empty();
        Map<Long, String> keyById = new HashMap<>();
        for (Obligation o : obligations) {
            String k = key(o);
            if (k != null) keyById.put(o.getObligationId(), k);
        }
        List<Requirement> reqs = requirements.findByObligationIdInOrderByObligationIdAscOrdinalAsc(keyById.keySet());
        Map<Long, List<Integer>> controlsByRequirement = reqs.isEmpty() ? Map.of()
            : requirementControls.findByRequirementIdIn(reqs.stream().map(Requirement::getRequirementId).toList()).stream()
                .collect(Collectors.groupingBy(RequirementControl::getRequirementId,
                    Collectors.mapping(RequirementControl::getControlId, Collectors.toList())));

        Map<String, List<Entry>> byKey = new HashMap<>();
        for (Requirement r : reqs) {
            byKey.computeIfAbsent(keyById.get(r.getObligationId()), k -> new ArrayList<>()).add(new Entry(
                r.getOrdinal(), r.getText(), r.getRiskId(), r.getStateOverride(), r.getOverrideReason(), r.getSource(),
                controlsByRequirement.getOrDefault(r.getRequirementId(), List.of())));
        }
        Map<String, List<Integer>> riskIdsByKey = new HashMap<>();
        for (RiskObligation p : riskObligations.findByObligationIdIn(keyById.keySet())) {
            riskIdsByKey.computeIfAbsent(keyById.get(p.getObligationId()), k -> new ArrayList<>()).add(p.getRiskId());
        }
        return new Snapshot(byKey, riskIdsByKey);
    }

    /** Re-attaches the snapshot to the recreated obligations; returns the control ids restored per obligation. */
    public Map<Long, Set<Integer>> restore(Snapshot snapshot, Collection<Obligation> recreated) {
        Map<Long, Set<Integer>> controlsByObligation = new HashMap<>();
        for (Obligation o : recreated) {
            String k = key(o);
            if (k == null) continue;
            for (Entry e : snapshot.byKey().getOrDefault(k, List.of())) {
                Requirement saved = requirements.save(Requirement.builder()
                    .obligationId(o.getObligationId())
                    .ordinal(e.ordinal())
                    .text(e.text())
                    .riskId(e.riskId())
                    .stateOverride(e.stateOverride())
                    .overrideReason(e.overrideReason())
                    .source(e.source())
                    .build());
                for (Integer controlId : e.controlIds()) {
                    requirementControls.save(new RequirementControl(saved.getRequirementId(), controlId));
                    controlsByObligation.computeIfAbsent(o.getObligationId(), x -> new java.util.HashSet<>()).add(controlId);
                }
            }
            for (Integer riskId : snapshot.riskIdsByKey().getOrDefault(k, List.of())) {
                riskObligations.save(new RiskObligation(riskId, o.getObligationId()));
            }
        }
        return controlsByObligation;
    }
}
