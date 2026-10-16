package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookClauseMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import java.util.Collection;
import java.util.List;

public interface RunbookClauseMapRepository extends JpaRepository<RunbookClauseMap, RunbookClauseMap.Key> {
    List<RunbookClauseMap> findByRunbookId(Long runbookId);
    List<RunbookClauseMap> findByRunbookIdIn(Collection<Long> runbookIds);
    List<RunbookClauseMap> findByClauseIdIn(Collection<Long> clauseIds);
    @Modifying
    void deleteByRunbookId(Long runbookId);
}
