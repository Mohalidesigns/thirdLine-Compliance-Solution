package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookRollbackStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import java.util.Collection;
import java.util.List;

public interface RunbookRollbackStepRepository extends JpaRepository<RunbookRollbackStep, Long> {
    List<RunbookRollbackStep> findByVersionIdOrderBySortOrderAsc(Long versionId);
    List<RunbookRollbackStep> findByVersionIdIn(Collection<Long> versionIds);
    @Modifying
    void deleteByVersionId(Long versionId);
}
