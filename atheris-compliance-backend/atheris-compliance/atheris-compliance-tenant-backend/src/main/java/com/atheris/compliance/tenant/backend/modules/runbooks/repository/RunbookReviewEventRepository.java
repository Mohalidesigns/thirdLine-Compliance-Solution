package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.RunbookReviewEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RunbookReviewEventRepository extends JpaRepository<RunbookReviewEvent, Long> {
    List<RunbookReviewEvent> findByStatusOrderByOpenedAtAsc(String status);
    boolean existsByRunbookIdAndTriggerTypeAndTriggerRef(Long runbookId, String triggerType, String triggerRef);
}
