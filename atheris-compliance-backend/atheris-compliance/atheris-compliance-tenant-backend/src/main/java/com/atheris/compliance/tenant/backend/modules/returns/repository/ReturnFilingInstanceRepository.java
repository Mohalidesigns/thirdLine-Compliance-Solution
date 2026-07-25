package com.atheris.compliance.tenant.backend.modules.returns.repository;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ReturnFilingInstanceRepository extends JpaRepository<ReturnFilingInstance, Long>, JpaSpecificationExecutor<ReturnFilingInstance> {
    List<ReturnFilingInstance> findByReturnId(Long returnId);
    List<ReturnFilingInstance> findByStatus(String status);
    Page<ReturnFilingInstance> findByStatus(String status, Pageable p);
    long countByStatus(String status);
    List<ReturnFilingInstance> findByDueDateBetweenOrderByDueDateAsc(LocalDate from, LocalDate to);
    Page<ReturnFilingInstance> findByDueDateBetweenOrderByDueDateAsc(LocalDate from, LocalDate to, Pageable p);
    List<ReturnFilingInstance> findByStatusNotInAndDueDateBefore(List<String> statuses, LocalDate today);
}
