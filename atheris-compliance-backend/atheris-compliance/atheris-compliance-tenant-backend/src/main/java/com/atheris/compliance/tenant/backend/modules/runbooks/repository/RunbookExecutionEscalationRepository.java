package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookExecutionEscalation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RunbookExecutionEscalationRepository extends JpaRepository<RunbookExecutionEscalation, Long> {
    List<RunbookExecutionEscalation> findByExecutionIdOrderBySentAtAsc(Long executionId);
    boolean existsByExecutionIdAndTriggerType(Long executionId, String triggerType);
    long countByAcknowledgedAtIsNull();
}
