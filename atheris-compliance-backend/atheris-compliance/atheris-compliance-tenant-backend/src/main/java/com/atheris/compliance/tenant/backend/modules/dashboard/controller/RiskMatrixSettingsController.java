package com.atheris.compliance.tenant.backend.modules.dashboard.controller;

import com.atheris.compliance.tenant.backend.modules.dashboard.entity.RiskMatrixConfig;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.RiskMatrixConfigRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/settings/risk-matrix")
@RequiredArgsConstructor
public class RiskMatrixSettingsController {

    private final RiskMatrixConfigRepository repo;
    private final TenantIdentityService tenantIdentity;

    @GetMapping
    public ResponseEntity<RiskMatrixConfig> get() {
        Long tenantId = tenantIdentity.currentTenantId();
        RiskMatrixConfig config = repo.findByTenantId(tenantId)
            .orElseGet(() -> repo.save(RiskMatrixConfig.builder()
                .tenantId(tenantId)
                .build()));
        return ResponseEntity.ok(config);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<RiskMatrixConfig> update(@RequestBody RiskMatrixConfig incoming) {
        Long tenantId = tenantIdentity.currentTenantId();
        RiskMatrixConfig config = repo.findByTenantId(tenantId)
            .orElse(RiskMatrixConfig.builder().tenantId(tenantId).build());
        if (incoming.getImpactLevels() != null) config.setImpactLevels(incoming.getImpactLevels());
        if (incoming.getLikelihoodLevels() != null) config.setLikelihoodLevels(incoming.getLikelihoodLevels());
        if (incoming.getScoringFormula() != null) config.setScoringFormula(incoming.getScoringFormula());
        if (incoming.getBandThresholds() != null) config.setBandThresholds(incoming.getBandThresholds());
        return ResponseEntity.ok(repo.save(config));
    }
}
