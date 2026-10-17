package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RunbookVersionRepository extends JpaRepository<RunbookVersion, Long> {
    List<RunbookVersion> findByRunbookIdOrderByVersionNumberDesc(Long runbookId);
    Optional<RunbookVersion> findByVersionIdAndRunbookId(Long versionId, Long runbookId);
    Optional<RunbookVersion> findFirstByRunbookIdOrderByVersionNumberDesc(Long runbookId);
    Optional<RunbookVersion> findFirstByRunbookIdAndStatusInOrderByVersionNumberDesc(Long runbookId, Collection<String> statuses);
    List<RunbookVersion> findByRunbookIdInAndStatusIn(Collection<Long> runbookIds, Collection<String> statuses);
    List<RunbookVersion> findByStatusOrderBySubmittedAtAsc(String status);
    List<RunbookVersion> findByRunbookIdAndStatus(Long runbookId, String status);
}
