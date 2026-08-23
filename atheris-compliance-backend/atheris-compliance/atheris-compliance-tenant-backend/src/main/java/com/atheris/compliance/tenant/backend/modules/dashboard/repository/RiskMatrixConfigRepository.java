package com.atheris.compliance.tenant.backend.modules.dashboard.repository;

import com.atheris.compliance.tenant.backend.modules.dashboard.entity.RiskMatrixConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RiskMatrixConfigRepository extends JpaRepository<RiskMatrixConfig, Long> {
    Optional<RiskMatrixConfig> findByTenantId(Long tenantId);
}
