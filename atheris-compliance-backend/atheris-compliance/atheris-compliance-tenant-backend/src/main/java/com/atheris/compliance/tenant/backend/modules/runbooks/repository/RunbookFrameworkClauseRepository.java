package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookFrameworkClause;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;
import java.util.List;

public interface RunbookFrameworkClauseRepository extends JpaRepository<RunbookFrameworkClause, Long>,
        JpaSpecificationExecutor<RunbookFrameworkClause> {
    List<RunbookFrameworkClause> findByFrameworkIdOrderByClauseRefAsc(Integer frameworkId);
    List<RunbookFrameworkClause> findByFrameworkIdIn(Collection<Integer> frameworkIds);
    boolean existsByFrameworkIdAndClauseRef(Integer frameworkId, String clauseRef);

    /** [framework_id, clause count] for every framework that has clauses. */
    @Query(value = "SELECT framework_id, COUNT(*) FROM runbook_framework_clauses GROUP BY framework_id", nativeQuery = true)
    List<Object[]> countByFramework();
}
