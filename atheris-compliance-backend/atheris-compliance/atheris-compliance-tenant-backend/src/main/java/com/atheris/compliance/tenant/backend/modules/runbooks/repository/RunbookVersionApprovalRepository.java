package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookVersionApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import java.util.Collection;
import java.util.List;

public interface RunbookVersionApprovalRepository extends JpaRepository<RunbookVersionApproval, Long> {
    List<RunbookVersionApproval> findByVersionIdOrderByDecidedAtAsc(Long versionId);
    List<RunbookVersionApproval> findByVersionIdIn(Collection<Long> versionIds);
    @Modifying
    void deleteByVersionId(Long versionId);
}
