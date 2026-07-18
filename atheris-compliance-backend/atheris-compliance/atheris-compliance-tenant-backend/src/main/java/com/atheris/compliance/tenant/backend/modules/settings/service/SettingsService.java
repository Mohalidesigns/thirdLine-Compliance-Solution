package com.atheris.compliance.tenant.backend.modules.settings.service;

import com.atheris.compliance.tenant.backend.modules.settings.dto.PollingConfigResponse;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantPollingConfig;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantPollingConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class SettingsService {

    private final TenantPollingConfigRepository repo;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    public PollingConfigResponse getPollingConfig() {
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
        TenantPollingConfig config = repo.findByTenantId(tenantId)
            .orElse(TenantPollingConfig.builder().tenantId(tenantId).build());
        config.setPollingIntervalMinutes(intervalMinutes);
        repo.save(config);
    }
}
