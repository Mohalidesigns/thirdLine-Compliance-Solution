package com.atheris.platform.modules.applicability.repository;

import com.atheris.platform.modules.applicability.entity.TenantEligibilityRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TenantEligibilityRuleRepository extends JpaRepository<TenantEligibilityRule, Long> {
    Optional<TenantEligibilityRule> findByInstrumentId(Long instrumentId);
}
