package com.atheris.compliance.tenant.backend.modules.runbooks.repository;

import com.atheris.compliance.tenant.backend.modules.runbooks.entity.Runbook;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.List;
import java.util.Optional;

public interface RunbookRepository extends JpaRepository<Runbook, Long>, JpaSpecificationExecutor<Runbook> {
    boolean existsByRunbookCode(String runbookCode);
    List<Runbook> findByRunbookCodeStartingWith(String prefix);
    List<Runbook> findBySourceTemplateCodeIsNotNull();
    Optional<Runbook> findFirstBySourceTemplateCodeAndStatusNotOrderByRunbookIdDesc(String code, String status);
    List<Runbook> findByStatusNot(String status);
}
