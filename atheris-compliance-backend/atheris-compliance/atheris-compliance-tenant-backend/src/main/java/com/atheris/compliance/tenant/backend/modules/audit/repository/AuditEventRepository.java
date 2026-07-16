package com.atheris.compliance.tenant.backend.modules.audit.repository;

import com.atheris.compliance.tenant.backend.modules.audit.entity.AuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AuditEventRepository extends JpaRepository<AuditEvent, Long>, JpaSpecificationExecutor<AuditEvent> {
    Page<AuditEvent> findBySubjectTypeAndSubjectIdOrderByOccurredAtDesc(String subjectType, Long subjectId, Pageable p);
    Optional<AuditEvent> findTopByOrderByEventIdDesc();
    Page<AuditEvent> findAllByOrderByOccurredAtDesc(Pageable p);
}
