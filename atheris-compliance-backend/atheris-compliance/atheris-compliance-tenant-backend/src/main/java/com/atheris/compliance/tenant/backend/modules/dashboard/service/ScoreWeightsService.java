package com.atheris.compliance.tenant.backend.modules.dashboard.service;

import com.atheris.compliance.tenant.backend.modules.dashboard.dto.ScoreWeightsDto;
import com.atheris.compliance.tenant.backend.modules.dashboard.entity.ComplianceScoreWeights;
import com.atheris.compliance.tenant.backend.modules.dashboard.repository.ComplianceScoreWeightsRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScoreWeightsService {

    private final ComplianceScoreWeightsRepository repo;
    private final TenantIdentityService tenantIdentity;

    public ScoreWeightsDto get() {
        return repo.findFirstByOrderByWeightIdAsc()
            .map(w -> ScoreWeightsDto.builder()
                .controlCoverage(w.getControlCoverage())
                .controlTests(w.getControlTests())
                .returnsOnTime(w.getReturnsOnTime())
                .findingsWithinSla(w.getFindingsWithinSla())
                .build())
            .orElseGet(() -> ScoreWeightsDto.builder().build());
    }

    @Transactional
    public ScoreWeightsDto save(ScoreWeightsDto dto) {
        int sum = nz(dto.getControlCoverage()) + nz(dto.getControlTests())
                + nz(dto.getReturnsOnTime()) + nz(dto.getFindingsWithinSla());
        if (sum != 100) throw ApiException.badRequest("Score weights must sum to 100 (got " + sum + ")");
        if (dto.getControlCoverage() < 0 || dto.getControlTests() < 0
                || dto.getReturnsOnTime() < 0 || dto.getFindingsWithinSla() < 0)
            throw ApiException.badRequest("Score weights cannot be negative");

        ComplianceScoreWeights w = repo.findFirstByOrderByWeightIdAsc()
            .orElseGet(() -> ComplianceScoreWeights.builder()
                .tenantId(tenantIdentity.currentTenantId()).build());
        w.setControlCoverage(dto.getControlCoverage());
        w.setControlTests(dto.getControlTests());
        w.setReturnsOnTime(dto.getReturnsOnTime());
        w.setFindingsWithinSla(dto.getFindingsWithinSla());
        repo.save(w);
        return get();
    }

    private static int nz(Integer v) { return v != null ? v : 0; }
}