package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookPrerequisite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import java.util.Collection;
import java.util.List;

public interface RunbookPrerequisiteRepository extends JpaRepository<RunbookPrerequisite, Long> {
    List<RunbookPrerequisite> findByVersionIdOrderBySortOrderAsc(Long versionId);
    List<RunbookPrerequisite> findByVersionIdIn(Collection<Long> versionIds);
    @Modifying
    void deleteByVersionId(Long versionId);
}
