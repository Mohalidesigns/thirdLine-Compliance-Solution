package com.atheris.tenant.modules.subscriptions.repository;

import com.atheris.tenant.modules.subscriptions.entity.TenantRegulatorPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TenantRegulatorPreferenceRepository extends JpaRepository<TenantRegulatorPreference, Integer> {
    Optional<TenantRegulatorPreference> findByRegulatorAbbr(String abbr);
    boolean existsByRegulatorAbbr(String abbr);
    List<TenantRegulatorPreference> findByIsSubscribedTrue();

    @Modifying
    @Query(value = "UPDATE tenant_regulator_preferences SET is_subscribed = :sub WHERE regulator_abbr = :abbr", nativeQuery = true)
    void setSubscribed(String abbr, Boolean sub);
}
