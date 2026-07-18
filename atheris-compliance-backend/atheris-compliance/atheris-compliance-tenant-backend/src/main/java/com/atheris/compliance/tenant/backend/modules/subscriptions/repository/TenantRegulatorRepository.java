package com.atheris.compliance.tenant.backend.modules.subscriptions.repository;

import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TenantRegulatorRepository extends JpaRepository<TenantRegulator, Long>,
    JpaSpecificationExecutor<TenantRegulator> {
    Page<TenantRegulator> findByTenantId(Long tenantId, Pageable pageable);
    List<TenantRegulator> findByTenantIdAndIsActiveTrue(Long tenantId);
    Optional<TenantRegulator> findByIdAndTenantId(Long id, Long tenantId);
    boolean existsByTenantIdAndNameIgnoreCase(Long tenantId, String name);
    long countByTenantId(Long tenantId);
}
