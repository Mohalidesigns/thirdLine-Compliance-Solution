package com.atheris.compliance.tenant.backend.modules.settings.repository;

import com.atheris.compliance.tenant.backend.modules.settings.entity.TenantComplianceSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TenantComplianceSettingsRepository extends JpaRepository<TenantComplianceSettings, Long> {
    Optional<TenantComplianceSettings> findByTenantId(Long tenantId);
}