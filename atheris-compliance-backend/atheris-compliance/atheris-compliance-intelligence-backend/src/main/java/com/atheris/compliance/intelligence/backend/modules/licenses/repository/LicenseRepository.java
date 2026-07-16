package com.atheris.compliance.intelligence.backend.modules.licenses.repository;

import com.atheris.compliance.intelligence.backend.modules.licenses.entity.License;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LicenseRepository extends JpaRepository<License, Integer>, JpaSpecificationExecutor<License> {
    Optional<License> findByLicenseKey(String licenseKey);
    List<License> findByTenantId(Long tenantId);
    List<License> findByStatus(String status);
    boolean existsByTenantIdAndStatus(Long tenantId, String status);
}
