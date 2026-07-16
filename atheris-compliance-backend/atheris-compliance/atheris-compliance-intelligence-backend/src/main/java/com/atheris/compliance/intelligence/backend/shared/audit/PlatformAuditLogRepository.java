package com.atheris.compliance.intelligence.backend.shared.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlatformAuditLogRepository extends JpaRepository<PlatformAuditLog, Long>, JpaSpecificationExecutor<PlatformAuditLog> {
    List<PlatformAuditLog> findBySubjectTypeAndSubjectIdOrderByOccurredAtDesc(
        String subjectType, Long subjectId);
}
