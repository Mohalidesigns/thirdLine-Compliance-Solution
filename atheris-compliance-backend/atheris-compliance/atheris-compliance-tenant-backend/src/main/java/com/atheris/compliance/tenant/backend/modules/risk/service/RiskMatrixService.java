package com.atheris.compliance.tenant.backend.modules.risk.service;

import com.atheris.compliance.tenant.backend.modules.dashboard.entity.RiskMatrixConfig;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.RiskMatrixConfigRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import com.atheris.compliance.tenant.backend.shared.util.BandThresholds;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class RiskMatrixService {

    private final RiskMatrixConfigRepository configRepo;
    private final ObligationClassificationRepository classifications;
    private final com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationService obligationService;
    private final TenantIdentityService tenantIdentity;

    @Transactional
    public Map<String, Integer> currentThresholds() {
        Long tenantId = tenantIdentity.currentTenantId();
        if (tenantId == null) return defaults();
        RiskMatrixConfig config = configRepo.findByTenantId(tenantId).orElse(null);
        return config == null || config.getBandThresholds() == null ? defaults() : config.getBandThresholds();
    }

    @Transactional
    public void loadThresholds() {
        apply(currentThresholds());
    }

    private void apply(Map<String, Integer> bands) {
        BandThresholds.apply(bands.get("moderate"), bands.get("high"), bands.get("critical"));
    }

    @Transactional
    public int recomputeBands() {
        loadThresholds();
        int updated = 0;
        for (ObligationClassification c : classifications.findAll()) {
            String before = c.getInherentRiskRating();
            c.computeInherentRisk();
            if (c.getInherentRiskRating() != null && !c.getInherentRiskRating().equals(before)) updated++;
        }
        try { obligationService.evictRegisterCache(); } catch (RuntimeException ignored) { }
        return updated;
    }

    private static Map<String, Integer> defaults() {
        return Map.of("moderate", BandThresholds.DEFAULT_MODERATE,
            "high", BandThresholds.DEFAULT_HIGH, "critical", BandThresholds.DEFAULT_CRITICAL);
    }
}