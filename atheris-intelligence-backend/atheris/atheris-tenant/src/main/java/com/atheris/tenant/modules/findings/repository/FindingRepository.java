package com.atheris.tenant.modules.findings.repository;

import com.atheris.tenant.modules.findings.entity.Finding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface FindingRepository extends JpaRepository<Finding, Long>, JpaSpecificationExecutor<Finding> {
    List<Finding> findByStatus(String status);
    List<Finding> findBySeverity(String severity);
    List<Finding> findByAssignedToUserId(Integer userId);
    long countByStatus(String status);
    long countBySeverity(String severity);
    List<Finding> findByStatusNotOrderByCreatedAtDesc(String status);
    List<Finding> findByStatusAndSeverity(String status, String severity);
    List<Finding> findByStatusInAndRemediationDeadlineBefore(List<String> statuses, LocalDate today);
}
