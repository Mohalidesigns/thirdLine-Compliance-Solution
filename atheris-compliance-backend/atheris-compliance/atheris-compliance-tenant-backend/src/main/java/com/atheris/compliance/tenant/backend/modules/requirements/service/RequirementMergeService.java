package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementRepository;
import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskObligation;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskObligationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class RequirementMergeService {

    private final RequirementRepository requirements;
    private final RiskObligationRepository riskObligations;

    /**
     * Re-points the requirements and risk links of merged-away obligations at the surviving one.
     * Where both hold a requirement at the same ordinal the keeper's is kept (its control links
     * and any edits stay); the loser's duplicate is deleted. Remaining ones are appended after the
     * keeper's last ordinal so (obligation, ordinal) stays unique.
     */
    public void moveToKeeper(Map<Long, Long> loserToKeeper) {
        if (loserToKeeper.isEmpty()) return;
        Set<Long> all = new HashSet<>(loserToKeeper.keySet());
        all.addAll(loserToKeeper.values());
        Map<Long, List<Requirement>> byObligation = requirements
            .findByObligationIdInOrderByObligationIdAscOrdinalAsc(all).stream()
            .collect(Collectors.groupingBy(Requirement::getObligationId));

        loserToKeeper.forEach((loser, keeper) -> {
            List<Requirement> loserReqs = byObligation.getOrDefault(loser, List.of());
            List<Requirement> keeperReqs = byObligation.getOrDefault(keeper, List.of());
            Set<String> keeperTexts = keeperReqs.stream().map(r -> normalize(r.getText())).collect(Collectors.toSet());
            int next = keeperReqs.stream().mapToInt(Requirement::getOrdinal).max().orElse(-1) + 1;
            for (Requirement r : loserReqs) {
                if (keeperTexts.contains(normalize(r.getText()))) {
                    requirements.delete(r);
                } else {
                    r.setObligationId(keeper);
                    r.setOrdinal(next++);
                    requirements.save(r);
                }
            }
        });

        List<RiskObligation> moved = riskObligations.findByObligationIdIn(loserToKeeper.keySet());
        Set<String> existing = riskObligations.findByObligationIdIn(loserToKeeper.values()).stream()
            .map(p -> p.getRiskId() + ":" + p.getObligationId()).collect(Collectors.toCollection(HashSet::new));
        for (RiskObligation p : moved) {
            Long keeper = loserToKeeper.get(p.getObligationId());
            riskObligations.delete(p);
            if (existing.add(p.getRiskId() + ":" + keeper)) {
                riskObligations.save(new RiskObligation(p.getRiskId(), keeper));
            }
        }
    }

    private static String normalize(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]", "");
    }
}
