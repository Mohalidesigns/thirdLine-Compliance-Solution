package com.atheris.compliance.tenant.backend.modules.risks.repository;

import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskObligation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface RiskObligationRepository extends JpaRepository<RiskObligation, RiskObligation.Key> {
    List<RiskObligation> findByRiskId(Integer riskId);
    List<RiskObligation> findByRiskIdIn(Collection<Integer> riskIds);
    List<RiskObligation> findByObligationIdIn(Collection<Long> obligationIds);
    void deleteByRiskId(Integer riskId);
}
