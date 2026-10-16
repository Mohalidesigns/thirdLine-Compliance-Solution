package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookExecutionSignoff;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RunbookExecutionSignoffRepository extends JpaRepository<RunbookExecutionSignoff, Long> {
    List<RunbookExecutionSignoff> findByExecutionIdOrderBySignedAtAsc(Long executionId);
}
