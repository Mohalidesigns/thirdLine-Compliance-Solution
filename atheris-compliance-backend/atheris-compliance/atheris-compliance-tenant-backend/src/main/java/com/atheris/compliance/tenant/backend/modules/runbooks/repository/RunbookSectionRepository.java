package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import java.util.Collection;
import java.util.List;

public interface RunbookSectionRepository extends JpaRepository<RunbookSection, Long> {
    List<RunbookSection> findByVersionIdOrderBySortOrderAsc(Long versionId);
    List<RunbookSection> findByVersionIdIn(Collection<Long> versionIds);
    @Modifying
    void deleteByVersionId(Long versionId);
}
