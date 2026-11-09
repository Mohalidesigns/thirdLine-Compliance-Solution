package com.atheris.compliance.tenant.backend.modules.risks.repository;

import com.atheris.compliance.tenant.backend.modules.risks.entity.RiskControl;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface RiskControlRepository extends JpaRepository<RiskControl, RiskControl.Key> {
    List<RiskControl> findByRiskId(Integer riskId);
    List<RiskControl> findByRiskIdIn(Collection<Integer> riskIds);
    List<RiskControl> findByControlIdIn(Collection<Integer> controlIds);
    void deleteByRiskId(Integer riskId);
}
