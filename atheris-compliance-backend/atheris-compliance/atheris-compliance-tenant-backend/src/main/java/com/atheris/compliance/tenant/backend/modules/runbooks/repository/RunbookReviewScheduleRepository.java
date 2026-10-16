package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookReviewSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RunbookReviewScheduleRepository extends JpaRepository<RunbookReviewSchedule, Long> {
    Optional<RunbookReviewSchedule> findByRunbookId(Long runbookId);
    List<RunbookReviewSchedule> findByRunbookIdIn(Collection<Long> runbookIds);
    List<RunbookReviewSchedule> findByNextReviewAtLessThanEqual(LocalDate date);
}
