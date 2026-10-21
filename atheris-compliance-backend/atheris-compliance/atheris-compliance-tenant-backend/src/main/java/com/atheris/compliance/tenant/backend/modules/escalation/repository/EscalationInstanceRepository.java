package com.atheris.compliance.tenant.backend.modules.escalation.repository;

import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EscalationInstanceRepository extends JpaRepository<EscalationInstance, Long> {
    Optional<EscalationInstance> findBySubjectTypeAndSubjectId(String subjectType, Long subjectId);
    List<EscalationInstance> findBySubjectType(String subjectType);
    void deleteBySubjectTypeAndSubjectId(String subjectType, Long subjectId);
}
