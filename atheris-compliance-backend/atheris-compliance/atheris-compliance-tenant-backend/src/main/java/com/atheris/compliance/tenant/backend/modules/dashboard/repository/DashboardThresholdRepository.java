package com.atheris.compliance.tenant.backend.modules.dashboard.repository;

import com.atheris.compliance.tenant.backend.modules.dashboard.entity.DashboardThreshold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DashboardThresholdRepository extends JpaRepository<DashboardThreshold, Long> {
    List<DashboardThreshold> findByTenantId(Long tenantId);
    Optional<DashboardThreshold> findByTenantIdAndMetricName(Long tenantId, String metricName);
    void deleteByTenantId(Long tenantId);
}
