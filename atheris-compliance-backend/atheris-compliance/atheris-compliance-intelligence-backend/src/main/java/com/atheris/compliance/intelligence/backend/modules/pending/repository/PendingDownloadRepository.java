package com.atheris.compliance.intelligence.backend.modules.pending.repository;

import com.atheris.compliance.intelligence.backend.modules.pending.entity.PendingDownload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface PendingDownloadRepository extends JpaRepository<PendingDownload, Long>, JpaSpecificationExecutor<PendingDownload> {
    List<PendingDownload> findByStatusOrderByDiscoveredAtDesc(String status);
    List<PendingDownload> findByRegulatorIdOrderByDiscoveredAtDesc(Integer regulatorId);
    boolean existsBySourceUrl(String sourceUrl);

    /** Download attempts that failed — a pending row carrying an error message. */
    @Query("select p from PendingDownload p where p.status = 'pending' and p.errorMessage is not null and p.errorMessage <> '' order by p.discoveredAt desc")
    List<PendingDownload> findFailedDownloads();
}
