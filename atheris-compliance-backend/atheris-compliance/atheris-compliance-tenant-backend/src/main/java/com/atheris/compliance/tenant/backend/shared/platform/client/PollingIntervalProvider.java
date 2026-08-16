package com.atheris.compliance.tenant.backend.shared.platform.client;

import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantPollingConfigRepository;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PollingIntervalProvider {

    private final TenantPollingConfigRepository repo;
    private final TenantIdentityService tenantIdentity;

    public long intervalMs() {
        Long tenantId = tenantIdentity.currentTenantId();
        if (tenantId == null) return 15 * 60 * 1000L;
        return repo.findByTenantId(tenantId)
            .map(c -> c.getPollingIntervalMinutes() != null
                ? c.getPollingIntervalMinutes() * 60 * 1000L
                : 15 * 60 * 1000L)
            .orElse(15 * 60 * 1000L);
    }
}
