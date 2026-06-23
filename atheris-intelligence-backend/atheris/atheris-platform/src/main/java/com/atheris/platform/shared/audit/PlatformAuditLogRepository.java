package com.atheris.platform.shared.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlatformAuditLogRepository extends JpaRepository<PlatformAuditLog, Long> {
    List<PlatformAuditLog> findBySubjectTypeAndSubjectIdOrderByOccurredAtDesc(
        String subjectType, Long subjectId);
}
