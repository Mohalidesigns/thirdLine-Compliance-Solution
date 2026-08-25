package com.atheris.compliance.tenant.backend.modules.sanctions.controller;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.RegulatorySanction;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.RegulatorySanctionRepository;
import com.atheris.compliance.tenant.backend.modules.sanctions.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/sanctions")
@RequiredArgsConstructor
public class SanctionsController {

    private final RegulatorySanctionRepository repo;

    @GetMapping
    public ResponseEntity<Page<SanctionListItem>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String sanctionType,
            @RequestParam(required = false) String actName,
            @RequestParam(required = false) Boolean enforced,
            Pageable p) {
        List<RegulatorySanction> all = repo.findAll();
        List<SanctionListItem> items = all.stream().map(this::toListItem).toList();

        if (q != null && !q.isBlank()) {
            String ql = q.toLowerCase();
            items = items.stream().filter(i ->
                (i.getActName() != null && i.getActName().toLowerCase().contains(ql)) ||
                (i.getSanctionType() != null && i.getSanctionType().toLowerCase().contains(ql)) ||
                (i.getDescription() != null && i.getDescription().toLowerCase().contains(ql))
            ).toList();
        }
        if (sanctionType != null && !sanctionType.isBlank()) {
            items = items.stream().filter(i -> sanctionType.equalsIgnoreCase(i.getSanctionType())).toList();
        }
        if (actName != null && !actName.isBlank()) {
            String rl = actName.toLowerCase();
            items = items.stream().filter(i ->
                i.getActName() != null && i.getActName().toLowerCase().contains(rl)
            ).toList();
        }
        if (enforced != null) {
            items = items.stream().filter(i -> enforced.equals(i.getHasBeenEnforced())).toList();
        }

        int start = (int) p.getOffset();
        int end = Math.min(start + p.getPageSize(), items.size());
        List<SanctionListItem> sub = start > items.size() ? List.of() : items.subList(start, end);
        return ResponseEntity.ok(new PageImpl<>(sub, p, items.size()));
    }

    @GetMapping("/stats")
    public ResponseEntity<SanctionStatsDto> stats() {
        List<RegulatorySanction> all = repo.findAll();
        long enforced = all.stream().filter(s -> Boolean.TRUE.equals(s.getHasBeenEnforced())).count();
        long highSeverity = all.stream().filter(s -> s.getSeverityScore() != null && s.getSeverityScore() >= 4).count();
        List<String> types = all.stream().map(RegulatorySanction::getSanctionType)
            .filter(t -> t != null && !t.isBlank()).distinct().sorted().toList();
        List<String> acts = all.stream().map(RegulatorySanction::getRegulationName)
            .filter(r -> r != null && !r.isBlank()).distinct().sorted().toList();
        return ResponseEntity.ok(SanctionStatsDto.builder()
            .total(all.size()).enforced(enforced).highSeverity(highSeverity)
            .totalExposure(repo.sumExposure())
            .sanctionTypes(types).actNames(acts).build());
    }

    private SanctionListItem toListItem(RegulatorySanction s) {
        return SanctionListItem.builder()
            .sanctionId(s.getSanctionId()).instrumentId(s.getInstrumentId())
            .actId(s.getRegulationId()).actName(s.getRegulationName())
            .sanctionType(s.getSanctionType()).sanctionAmountNaira(s.getSanctionAmountNaira())
            .sanctionAmountPerDay(s.getSanctionAmountPerDay()).liableRoles(s.getLiableRoles())
            .severityScore(s.getSeverityScore()).hasBeenEnforced(s.getHasBeenEnforced())
            .description(s.getDescription()).sourceSectionReference(s.getSourceSectionReference())
            .riskExplanation(s.getRiskExplanation()).penaltyDetails(s.getPenaltyDetails())
            .build();
    }
}