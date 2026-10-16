package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookStepExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RunbookStepExecutionRepository extends JpaRepository<RunbookStepExecution, Long> {
    List<RunbookStepExecution> findByExecutionIdOrderBySortOrderAsc(Long executionId);
    Optional<RunbookStepExecution> findByStepExecIdAndExecutionId(Long stepExecId, Long executionId);
    List<RunbookStepExecution> findByExecutionIdInAndStatus(Collection<Long> executionIds, String status);
}
