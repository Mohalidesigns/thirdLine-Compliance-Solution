package com.atheris.platform.modules.licenses.repository;

import com.atheris.platform.modules.licenses.entity.License;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LicenseRepository extends JpaRepository<License, Integer> {
    Optional<License> findByLicenseKey(String licenseKey);
    List<License> findByTenantId(Long tenantId);
    List<License> findByStatus(String status);
    boolean existsByTenantIdAndStatus(Long tenantId, String status);
    @Query(value = "SELECT * FROM licenses WHERE status IN ('active', 'grace_period') AND expires_at < CURRENT_TIMESTAMP", nativeQuery = true)
    List<License> findExpiredActiveLicenses();
    @Query(value = "SELECT status::VARCHAR, COUNT(*)::BIGINT FROM licenses GROUP BY status", nativeQuery = true)
    List<Object[]> countByStatus();
}
