package com.atheris.compliance.tenant.backend.modules.subscriptions.repository;

import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantPollingConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TenantPollingConfigRepository extends JpaRepository<TenantPollingConfig, Long> {
    Optional<TenantPollingConfig> findByTenantId(Long tenantId);
}
