package com.atheris.platform.modules.instruments.controller;

import com.atheris.platform.modules.instruments.dto.InstrumentTenantClassificationDto;
import com.atheris.platform.modules.instruments.entity.Instrument;
import com.atheris.platform.modules.instruments.repository.InstrumentRepository;
import com.atheris.platform.modules.notifications.repository.ObligationWatchRepository;
import com.atheris.platform.modules.regulators.repository.RegulatorRepository;
import com.atheris.platform.modules.tenants.entity.Tenant;
import com.atheris.platform.modules.tenants.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/instruments")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class AdminInstrumentController {

    private final InstrumentRepository instruments;
    private final TenantRepository tenants;
    private final ObligationWatchRepository watches;
    private final RegulatorRepository regulators;

    @GetMapping("/{id}/tenant-classifications")
    public ResponseEntity<InstrumentTenantClassificationDto> getTenantClassifications(@PathVariable Long id) {
        Instrument inst = instruments.findById(id)
            .orElseThrow(() -> new RuntimeException("Instrument not found: " + id));

        String regName = regulators.findById(inst.getRegulatorId())
            .map(r -> r.getName())
            .orElse("Unknown");

        List<Tenant> eligible = tenants.findEligibleTenants(
            regulators.findById(inst.getRegulatorId()).map(r -> r.getAbbreviation()).orElse(""),
            inst.getLicenceTypesApplicable() != null
                ? inst.getLicenceTypesApplicable().toArray(new String[0])
                : new String[0]);

        List<InstrumentTenantClassificationDto.TenantClassification> tcList = eligible.stream()
            .map(t -> {
                var watch = watches.findByInstrumentIdAndTenantId(id, t.getTenantId());
                return InstrumentTenantClassificationDto.TenantClassification.builder()
                    .tenantId(t.getTenantId())
                    .legalName(t.getLegalName())
                    .shortName(t.getShortName())
                    .licenceType(t.getLicenceType())
                    .classification(watch.map(w -> w.getClassification()).orElse(null))
                    .classifiedAt(watch.map(w -> w.getClassifiedAt()).orElse(null))
                    .build();
            })
            .toList();

        return ResponseEntity.ok(InstrumentTenantClassificationDto.builder()
            .instrumentId(inst.getInstrumentId())
            .sourceTitle(inst.getSourceTitle())
            .regulatorName(regName)
            .areaOfFocus(inst.getAreaOfFocus())
            .riskRating(inst.getRiskRating())
            .aiSummary(inst.getAiSummary())
            .tenantClassifications(tcList)
            .build());
    }
}
