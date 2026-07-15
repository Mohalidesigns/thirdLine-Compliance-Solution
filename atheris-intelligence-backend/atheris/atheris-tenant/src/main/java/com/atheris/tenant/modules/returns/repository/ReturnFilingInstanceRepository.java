package com.atheris.tenant.modules.returns.repository;

import com.atheris.tenant.modules.returns.entity.ReturnFilingInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ReturnFilingInstanceRepository extends JpaRepository<ReturnFilingInstance, Long> {
    List<ReturnFilingInstance> findByReturnId(Long returnId);
    List<ReturnFilingInstance> findByStatus(String status);
    long countByStatus(String status);

    @Query(value = "SELECT * FROM return_filing_instances WHERE due_date BETWEEN :from AND :to ORDER BY due_date ASC", nativeQuery = true)
    List<ReturnFilingInstance> findDueBetween(LocalDate from, LocalDate to);

    @Query(value = "SELECT * FROM return_filing_instances WHERE status NOT IN ('Submitted','Submitted Late') AND due_date < :today", nativeQuery = true)
    List<ReturnFilingInstance> findOverdue(LocalDate today);
}
