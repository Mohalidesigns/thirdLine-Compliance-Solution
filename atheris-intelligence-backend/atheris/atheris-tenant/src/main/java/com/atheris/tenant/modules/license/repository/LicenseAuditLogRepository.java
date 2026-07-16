package com.atheris.tenant.modules.license.repository;

import com.atheris.tenant.modules.license.entity.LicenseAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LicenseAuditLogRepository extends JpaRepository<LicenseAuditLog, Integer> {
    List<LicenseAuditLog> findTop50ByOrderByCreatedAtDesc();
}
