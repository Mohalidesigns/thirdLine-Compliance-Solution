package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface RunbookScheduleRepository extends JpaRepository<RunbookSchedule, Long> {
    List<RunbookSchedule> findByRunbookIdOrderByScheduleIdAsc(Long runbookId);
    List<RunbookSchedule> findByRunbookIdInAndIsActiveTrue(Collection<Long> runbookIds);
    List<RunbookSchedule> findByIsActiveTrueAndNextRunAtLessThanEqual(LocalDate date);
    List<RunbookSchedule> findByIsActiveTrueAndNextRunAtBetweenOrderByNextRunAtAsc(LocalDate from, LocalDate to);
}
