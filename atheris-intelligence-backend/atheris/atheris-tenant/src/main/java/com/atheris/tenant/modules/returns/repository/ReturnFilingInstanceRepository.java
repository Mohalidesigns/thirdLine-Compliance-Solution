package com.atheris.tenant.modules.returns.repository;

import com.atheris.tenant.modules.returns.entity.ReturnFilingInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ReturnFilingInstanceRepository extends JpaRepository<ReturnFilingInstance, Long>, JpaSpecificationExecutor<ReturnFilingInstance> {
    List<ReturnFilingInstance> findByReturnId(Long returnId);
    List<ReturnFilingInstance> findByStatus(String status);
    long countByStatus(String status);
    List<ReturnFilingInstance> findByDueDateBetweenOrderByDueDateAsc(LocalDate from, LocalDate to);
    List<ReturnFilingInstance> findByStatusNotInAndDueDateBefore(List<String> statuses, LocalDate today);
}
