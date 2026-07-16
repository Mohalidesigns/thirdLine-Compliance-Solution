package com.atheris.compliance.tenant.backend.modules.license.repository;

import com.atheris.compliance.tenant.backend.modules.license.entity.LicenseAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LicenseAuditLogRepository extends JpaRepository<LicenseAuditLog, Integer>, JpaSpecificationExecutor<LicenseAuditLog> {
    List<LicenseAuditLog> findTop50ByOrderByCreatedAtDesc();
}
