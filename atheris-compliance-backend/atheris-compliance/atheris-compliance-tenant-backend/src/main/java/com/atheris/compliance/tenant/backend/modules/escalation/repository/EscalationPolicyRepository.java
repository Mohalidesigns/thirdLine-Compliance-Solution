package com.atheris.compliance.tenant.backend.modules.escalation.repository;

import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EscalationPolicyRepository extends JpaRepository<EscalationPolicy, Long> {
    List<EscalationPolicy> findBySubjectTypeOrderByNameAsc(String subjectType);
    List<EscalationPolicy> findAllByOrderBySubjectTypeAscNameAsc();
    List<EscalationPolicy> findByIsDefaultTrueOrderBySubjectTypeAscNameAsc();
}
