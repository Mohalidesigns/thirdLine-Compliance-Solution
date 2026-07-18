package com.atheris.compliance.tenant.backend.shared.platform.client;

import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantPollingConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PollingIntervalProvider {

    private final TenantPollingConfigRepository repo;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    public long intervalMs() {
        return repo.findByTenantId(tenantId)
            .map(c -> c.getPollingIntervalMinutes() != null
                ? c.getPollingIntervalMinutes() * 60 * 1000L
                : 15 * 60 * 1000L)
            .orElse(15 * 60 * 1000L);
    }
}
