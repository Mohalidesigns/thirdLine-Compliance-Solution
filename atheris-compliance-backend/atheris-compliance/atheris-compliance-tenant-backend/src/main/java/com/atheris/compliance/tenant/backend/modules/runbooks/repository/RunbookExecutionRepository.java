package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookExecution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface RunbookExecutionRepository extends JpaRepository<RunbookExecution, Long>, JpaSpecificationExecutor<RunbookExecution> {
    List<RunbookExecution> findTop5ByRunbookIdOrderByCreatedAtDesc(Long runbookId);
    List<RunbookExecution> findByRunbookIdIn(Collection<Long> runbookIds);
    List<RunbookExecution> findByStatusInAndDueAtIsNotNull(Collection<String> statuses);
    List<RunbookExecution> findByStatusIn(Collection<String> statuses);
    long countByStatusIn(Collection<String> statuses);
    long countByRunbookId(Long runbookId);
    boolean existsByScheduleIdAndScheduledFor(Long scheduleId, LocalDate scheduledFor);
    List<RunbookExecution> findByClosedAtAfter(Instant after);

    @Query(value = "SELECT nextval('runbook_execution_ref_seq')", nativeQuery = true)
    long nextRefNumber();

    /** [status, count] across all executions. */
    @Query(value = "SELECT status, COUNT(*) FROM runbook_executions GROUP BY status", nativeQuery = true)
    List<Object[]> countByStatus();
}
