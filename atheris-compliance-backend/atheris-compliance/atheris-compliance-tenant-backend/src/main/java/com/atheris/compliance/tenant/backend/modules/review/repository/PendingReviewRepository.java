package com.atheris.compliance.tenant.backend.modules.review.repository;

import com.atheris.compliance.tenant.backend.modules.review.entity.PendingReview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PendingReviewRepository extends JpaRepository<PendingReview, Long> {
    Optional<PendingReview> findByInstrumentIdAndTenantId(Long instrumentId, Long tenantId);
    Optional<PendingReview> findByUploadIdAndTenantId(UUID uploadId, Long tenantId);
    Optional<PendingReview> findByReviewIdAndTenantId(Long reviewId, Long tenantId);
    Page<PendingReview> findByTenantId(Long tenantId, Pageable pageable);
    List<PendingReview> findByTenantIdAndStatus(Long tenantId, String status);
    long countByTenantIdAndStatus(Long tenantId, String status);
    long countByTenantIdAndStatusAndSource(Long tenantId, String status, String source);
}
