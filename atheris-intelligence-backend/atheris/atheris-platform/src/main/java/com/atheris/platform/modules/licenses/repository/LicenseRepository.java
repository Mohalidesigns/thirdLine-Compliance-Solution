package com.atheris.platform.modules.licenses.repository;

import com.atheris.platform.modules.licenses.dto.LicenseStatusCount;
import com.atheris.platform.modules.licenses.entity.License;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LicenseRepository extends JpaRepository<License, Integer>, JpaSpecificationExecutor<License> {
    Optional<License> findByLicenseKey(String licenseKey);
    List<License> findByTenantId(Long tenantId);
    List<License> findByStatus(String status);
    boolean existsByTenantIdAndStatus(Long tenantId, String status);
    @Query("SELECT l FROM License l WHERE l.status IN (:statuses) AND l.expiresAt < CURRENT_TIMESTAMP")
    List<License> findExpiredActiveLicenses(@Param("statuses") List<String> statuses);
    @Query("SELECT l.status AS status, COUNT(l) AS count FROM License l GROUP BY l.status")
    List<LicenseStatusCount> countByStatus();
}
