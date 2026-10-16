package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookEvidenceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface RunbookEvidenceItemRepository extends JpaRepository<RunbookEvidenceItem, Long> {
    List<RunbookEvidenceItem> findByStepExecIdInOrderByCapturedAtAsc(Collection<Long> stepExecIds);
    List<RunbookEvidenceItem> findByStepExecIdOrderByCapturedAtAsc(Long stepExecId);
}
