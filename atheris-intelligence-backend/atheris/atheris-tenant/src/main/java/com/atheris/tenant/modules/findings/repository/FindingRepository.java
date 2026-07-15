package com.atheris.tenant.modules.findings.repository;

import com.atheris.tenant.modules.findings.entity.Finding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface FindingRepository extends JpaRepository<Finding, Long> {
    List<Finding> findByStatus(String status);
    List<Finding> findBySeverity(String severity);
    List<Finding> findByAssignedToUserId(Integer userId);
    long countByStatus(String status);
    long countBySeverity(String severity);

    @Query(value = "SELECT * FROM findings WHERE status NOT IN ('Closed') ORDER BY created_at DESC", nativeQuery = true)
    List<Finding> findAllOpen();

    @Query(value = "SELECT * FROM findings WHERE status = 'Open' AND severity = 'Critical'", nativeQuery = true)
    List<Finding> findCriticalOpen();

    @Query(value = "SELECT * FROM findings WHERE status IN ('Open','In Remediation') AND remediation_deadline < :today", nativeQuery = true)
    List<Finding> findOverdueRemediation(LocalDate today);
}
