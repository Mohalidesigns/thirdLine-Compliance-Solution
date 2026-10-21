package com.atheris.compliance.tenant.backend.modules.escalation.repository;

import com.atheris.compliance.tenant.backend.modules.escalation.entity.EscalationEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EscalationEventRepository extends JpaRepository<EscalationEvent, Long> {
    boolean existsBySubjectTypeAndSubjectIdAndTriggerTypeAndLevel(String subjectType, Long subjectId, String triggerType, Integer level);
    Optional<EscalationEvent> findBySubjectTypeAndSubjectIdAndTriggerTypeAndLevel(String subjectType, Long subjectId, String triggerType, Integer level);
    List<EscalationEvent> findBySubjectTypeAndSubjectIdOrderByFiredAtDesc(String subjectType, Long subjectId);
}
