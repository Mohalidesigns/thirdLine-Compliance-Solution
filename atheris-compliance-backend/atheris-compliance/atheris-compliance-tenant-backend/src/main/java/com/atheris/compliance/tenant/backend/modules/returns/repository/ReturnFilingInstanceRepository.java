package com.atheris.compliance.tenant.backend.modules.returns.repository;

import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingInstance;
import com.atheris.compliance.tenant.backend.modules.returns.entity.ReturnFilingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReturnFilingInstanceRepository extends JpaRepository<ReturnFilingInstance, Long>, JpaSpecificationExecutor<ReturnFilingInstance> {
    List<ReturnFilingInstance> findByReturnId(Long returnId);
    List<ReturnFilingInstance> findByStatus(ReturnFilingStatus status);
    Page<ReturnFilingInstance> findByStatus(ReturnFilingStatus status, Pageable p);
    long countByStatus(ReturnFilingStatus status);
    List<ReturnFilingInstance> findByDueDateBetweenOrderByDueDateAsc(LocalDate from, LocalDate to);
    Page<ReturnFilingInstance> findByDueDateBetweenOrderByDueDateAsc(LocalDate from, LocalDate to, Pageable p);
    List<ReturnFilingInstance> findByStatusNotInAndDueDateBefore(List<ReturnFilingStatus> statuses, LocalDate today);
    boolean existsByReturnIdAndPeriod(Long returnId, String period);
    Optional<ReturnFilingInstance> findTopByReturnIdOrderByPeriodDesc(Long returnId);
}