package com.atheris.compliance.tenant.backend.modules.imports.repository;

import com.atheris.compliance.tenant.backend.modules.imports.entity.ImportBatch;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import java.util.List;
import java.util.Optional;

public interface ImportBatchRepository extends JpaRepository<ImportBatch, Long> {
    /** Row-locks the batch so two concurrent commits of the same batch cannot both import it. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ImportBatch> findWithLockByBatchId(Long batchId);

    List<ImportBatch> findTop50ByEntityTypeOrderByCreatedAtDesc(String entityType);

    List<ImportBatch> findTop50ByOrderByCreatedAtDesc();
}
