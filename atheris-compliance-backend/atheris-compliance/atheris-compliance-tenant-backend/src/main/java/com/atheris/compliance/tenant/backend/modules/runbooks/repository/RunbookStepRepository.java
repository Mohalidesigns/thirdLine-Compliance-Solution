package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookStep;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface RunbookStepRepository extends JpaRepository<RunbookStep, Long> {
    List<RunbookStep> findBySectionIdInOrderBySortOrderAsc(Collection<Long> sectionIds);
}
