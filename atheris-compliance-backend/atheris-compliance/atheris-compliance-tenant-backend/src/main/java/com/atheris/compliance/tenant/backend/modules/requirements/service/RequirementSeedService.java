package com.atheris.compliance.tenant.backend.modules.requirements.service;

import com.atheris.compliance.tenant.backend.modules.controls.entity.Control;
import com.atheris.compliance.tenant.backend.modules.controls.repository.ControlRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.Requirement;
import com.atheris.compliance.tenant.backend.modules.requirements.entity.RequirementControl;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementControlRepository;
import com.atheris.compliance.tenant.backend.modules.requirements.repository.RequirementRepository;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformRegulationSeed;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class RequirementSeedService {

    private final RequirementRepository requirements;
    private final RequirementControlRepository requirementControls;
    private final ControlRepository controls;

    public record Result(int requirements, int requirementControlLinks) {}

    /**
     * Seeds the requirements of freshly created tenant obligations. {@code platformToTenant}
     * translates platform obligation ids to this tenant's ids; controls are resolved by their
     * toolkit control number. Idempotent: a requirement already present for (obligation, ordinal)
     * is left untouched, so a tenant's edits survive a re-seed.
     */
    public Result seed(List<PlatformRegulationSeed.ObligationItem> items,
                       Map<Long, Long> platformToTenant) {
        if (items == null || items.isEmpty()) return new Result(0, 0);

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

        for (PlatformRegulationSeed.ObligationItem o : items) {
            Long tenantId = o.getObligationId() == null ? null : platformToTenant.get(o.getObligationId());
            if (tenantId == null) continue;
            Set<Integer> have = existingOrdinals.getOrDefault(tenantId, Set.of());
            for (PlatformRegulationSeed.RequirementItem r : orEmpty(o.getRequirements())) {
                if (r.getText() == null || r.getText().isBlank() || r.getOrdinal() == null) continue;
                if (have.contains(r.getOrdinal())) continue;
                Requirement saved = requirements.save(Requirement.builder()
                    .obligationId(tenantId)
                    .ordinal(r.getOrdinal())
                    .text(r.getText().trim())
                    .build());
                newRequirements++;
                for (String number : orEmpty(r.getControlNumbers())) {
                    Integer controlId = controlIdByNumber.get(number);
                    if (controlId == null) continue;
                    requirementControls.save(new RequirementControl(saved.getRequirementId(), controlId));
                    links++;
                }
            }
        }
        log.info("[RequirementSeed] requirements={}, requirement-control links={}",
            newRequirements, links);
        return new Result(newRequirements, links);
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }
}
