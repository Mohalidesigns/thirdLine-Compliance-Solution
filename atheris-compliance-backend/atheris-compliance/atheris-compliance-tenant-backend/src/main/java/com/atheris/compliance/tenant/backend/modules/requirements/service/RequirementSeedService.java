package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.RequirementControl;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementControlRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementRepository;
import com.atheris.compliance.tenant.backend.modules.risks.entity.Risk;
import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskControl;
import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskObligation;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskControlRepository;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskObligationRepository;
import com.atheris.compliance.tenant.backend.modules.risks.repository.RiskRepository;
import com.atheris.compliance.common.risk.RiskBands;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class RequirementSeedService {

    private final RiskRepository risks;
    private final RequirementRepository requirements;
    private final RequirementControlRepository requirementControls;
    private final RiskControlRepository riskControls;
    private final RiskObligationRepository riskObligations;
    private final ControlRepository controls;

    public record Result(int requirements, int risks, int requirementControlLinks) {}

    /**
     * Seeds the requirements of freshly created tenant obligations and the risks they point at.
     * {@code platformToTenant} translates platform obligation ids to this tenant's ids; controls
     * are resolved by their toolkit control number. Idempotent: a requirement already present for
     * (obligation, ordinal) is left untouched, so a tenant's edits survive a re-seed.
     */
    public Result seed(List<PlatformRegulationSeed.ObligationItem> items,
                       Map<Long, Long> platformToTenant) {
        if (items == null || items.isEmpty()) return new Result(0, 0, 0);

        Map<String, Risk> riskByCode = risks.findAll().stream()
            .collect(Collectors.toMap(Risk::getRiskCode, Function.identity(), (a, b) -> a, HashMap::new));
        int newRisks = 0;
        for (PlatformRegulationSeed.ObligationItem o : items) {
            for (PlatformRegulationSeed.RequirementItem r : orEmpty(o.getRequirements())) {
                if (r.getRiskCode() == null || riskByCode.containsKey(r.getRiskCode())) continue;
                Risk saved = risks.save(Risk.builder()
                    .riskCode(r.getRiskCode())
                    .name(r.getRiskName() != null ? r.getRiskName() : r.getRiskCode())
                    .riskType(r.getRiskType())
                    .areaOfFocus(r.getRiskArea())
                    .inherentLikelihood(r.getRiskLikelihood())
                    .inherentImpact(r.getRiskImpact())
                    .inherentBand(RiskBands.band(r.getRiskLikelihood(), r.getRiskImpact()))
                    .build());
                riskByCode.put(saved.getRiskCode(), saved);
                newRisks++;
            }
        }

        Set<String> wantedNumbers = new HashSet<>();
        for (PlatformRegulationSeed.ObligationItem o : items) {
            for (PlatformRegulationSeed.RequirementItem r : orEmpty(o.getRequirements())) {
                wantedNumbers.addAll(orEmpty(r.getControlNumbers()));
            }
        }
        Map<String, Integer> controlIdByNumber = wantedNumbers.isEmpty() ? Map.of()
            : controls.findByControlNumberIn(wantedNumbers).stream()
                .collect(Collectors.toMap(Control::getControlNumber, Control::getControlId, (a, b) -> a));

        Set<Long> tenantObligationIds = new HashSet<>(platformToTenant.values());
        Map<Long, Set<Integer>> existingOrdinals = requirements
            .findByObligationIdInOrderByObligationIdAscOrdinalAsc(tenantObligationIds).stream()
            .collect(Collectors.groupingBy(Requirement::getObligationId,
                Collectors.mapping(Requirement::getOrdinal, Collectors.toSet())));

        int newRequirements = 0;
        int links = 0;
        Set<RiskObligation> riskObligationPairs = new HashSet<>(riskObligations.findAll().stream()
            .map(p -> new RiskObligation(p.getRiskId(), p.getObligationId())).toList());
        Set<String> riskControlPairs = new HashSet<>();
        for (RiskControl existing : riskControls.findAll()) {
            riskControlPairs.add(existing.getRiskId() + ":" + existing.getControlId());
        }
        Map<Long, Set<Integer>> controlsByObligation = new HashMap<>();

        List<RiskObligation> newRiskObligations = new ArrayList<>();
        List<RiskControl> newRiskControls = new ArrayList<>();
        for (PlatformRegulationSeed.ObligationItem o : items) {
            Long tenantId = o.getObligationId() == null ? null : platformToTenant.get(o.getObligationId());
            if (tenantId == null) continue;
            Set<Integer> have = existingOrdinals.getOrDefault(tenantId, Set.of());
            for (PlatformRegulationSeed.RequirementItem r : orEmpty(o.getRequirements())) {
                if (r.getText() == null || r.getText().isBlank() || r.getOrdinal() == null) continue;
                if (have.contains(r.getOrdinal())) continue;
                Risk risk = r.getRiskCode() == null ? null : riskByCode.get(r.getRiskCode());
                Requirement saved = requirements.save(Requirement.builder()
                    .obligationId(tenantId)
                    .ordinal(r.getOrdinal())
                    .text(r.getText().trim())
                    .riskId(risk == null ? null : risk.getRiskId())
                    .build());
                newRequirements++;
                for (String number : orEmpty(r.getControlNumbers())) {
                    Integer controlId = controlIdByNumber.get(number);
                    if (controlId == null) continue;
                    requirementControls.save(new RequirementControl(saved.getRequirementId(), controlId));
                    links++;
                    controlsByObligation.computeIfAbsent(tenantId, k -> new HashSet<>()).add(controlId);
                    if (risk != null && riskControlPairs.add(risk.getRiskId() + ":" + controlId)) {
                        newRiskControls.add(new RiskControl(risk.getRiskId(), controlId));
                    }
                }
                if (risk != null) {
                    RiskObligation pair = new RiskObligation(risk.getRiskId(), tenantId);
                    if (riskObligationPairs.add(pair)) newRiskObligations.add(pair);
                }
            }
        }
        riskObligations.saveAll(newRiskObligations);
        riskControls.saveAll(newRiskControls);
        log.info("[RequirementSeed] requirements={}, risks={}, requirement-control links={}",
            newRequirements, newRisks, links);
        return new Result(newRequirements, newRisks, links);
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }
}
