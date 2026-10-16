package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookEscalationPath;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import java.util.Collection;
import java.util.List;

public interface RunbookEscalationPathRepository extends JpaRepository<RunbookEscalationPath, Long> {
    List<RunbookEscalationPath> findByVersionIdOrderByLevelAsc(Long versionId);
    List<RunbookEscalationPath> findByVersionIdIn(Collection<Long> versionIds);
    @Modifying
    void deleteByVersionId(Long versionId);
}
