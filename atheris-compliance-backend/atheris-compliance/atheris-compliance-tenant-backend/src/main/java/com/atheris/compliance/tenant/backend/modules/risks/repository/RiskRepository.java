package com.atheris.compliance.tenant.backend.modules.risks.repository;

import com.atheris.compliance.tenant.backend.modules.risks.entity.Risk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RiskRepository extends JpaRepository<Risk, Integer>, JpaSpecificationExecutor<Risk> {
    Optional<Risk> findByRiskCode(String riskCode);
    List<Risk> findByRiskCodeIn(Collection<String> riskCodes);
    List<Risk> findByRiskIdIn(Collection<Integer> riskIds);
    boolean existsByRiskCode(String riskCode);
}
