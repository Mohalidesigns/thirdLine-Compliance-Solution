package com.atheris.tenant.modules.subscriptions.repository;

import com.atheris.tenant.modules.subscriptions.entity.TenantRegulatorPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TenantRegulatorPreferenceRepository extends JpaRepository<TenantRegulatorPreference, Integer>, JpaSpecificationExecutor<TenantRegulatorPreference> {
    Optional<TenantRegulatorPreference> findByRegulatorId(Integer regulatorId);
    boolean existsByRegulatorId(Integer regulatorId);
    List<TenantRegulatorPreference> findByIsSubscribedTrue();
}
