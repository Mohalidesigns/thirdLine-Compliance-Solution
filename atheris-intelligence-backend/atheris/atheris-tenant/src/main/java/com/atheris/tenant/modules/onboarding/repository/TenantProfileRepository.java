package com.atheris.tenant.modules.onboarding.repository;

import com.atheris.tenant.modules.onboarding.entity.TenantProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TenantProfileRepository extends JpaRepository<TenantProfile, Integer>, JpaSpecificationExecutor<TenantProfile> {
    Optional<TenantProfile> findByTenantId(Long tenantId);
}
