package com.atheris.compliance.tenant.backend.modules.subscriptions.repository;

import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.UploadJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UploadJobRepository extends JpaRepository<UploadJob, Long> {
    Optional<UploadJob> findByUploadIdAndTenantId(UUID uploadId, Long tenantId);
    Page<UploadJob> findByTenantId(Long tenantId, Pageable pageable);
}
