package com.atheris.compliance.tenant.backend.modules.settings.service;

import com.atheris.compliance.tenant.backend.modules.settings.dto.PollingConfigResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantPollingConfig;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantPollingConfigRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class SettingsService {

    private final TenantPollingConfigRepository repo;
    private final TenantIdentityService tenantIdentity;

    public PollingConfigResponse getPollingConfig() {
        Long tenantId = tenantIdentity.currentTenantId();
        if (tenantId == null) {
            return PollingConfigResponse.builder().intervalMinutes(15).build();
        }
        return repo.findByTenantId(tenantId)
            .map(c -> PollingConfigResponse.builder()
                .intervalMinutes(c.getPollingIntervalMinutes())
                .lastPolledAt(c.getLastPolledAt())
                .build())
            .orElse(PollingConfigResponse.builder()
                .intervalMinutes(15)
                .build());
    }

    @Transactional
    public void updatePollingConfig(Integer intervalMinutes) {
        Long tenantId = tenantIdentity.currentTenantId();
        TenantPollingConfig config = repo.findByTenantId(tenantId)
            .orElse(TenantPollingConfig.builder().tenantId(tenantId).build());
        config.setPollingIntervalMinutes(intervalMinutes);
        repo.save(config);
    }
}
