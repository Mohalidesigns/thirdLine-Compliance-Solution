package com.atheris.compliance.tenant.backend.modules.escalation.repository;

import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationPolicyLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EscalationPolicyLevelRepository extends JpaRepository<EscalationPolicyLevel, Long> {
    List<EscalationPolicyLevel> findByPolicyIdOrderByLevelNoAsc(Long policyId);
    void deleteByPolicyId(Long policyId);
}
