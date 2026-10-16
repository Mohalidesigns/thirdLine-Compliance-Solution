package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookStepEvidenceReq;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface RunbookStepEvidenceReqRepository extends JpaRepository<RunbookStepEvidenceReq, Long> {
    List<RunbookStepEvidenceReq> findByStepIdIn(Collection<Long> stepIds);
}
