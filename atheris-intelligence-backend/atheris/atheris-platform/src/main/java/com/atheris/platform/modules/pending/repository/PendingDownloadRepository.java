package com.atheris.platform.modules.pending.repository;

import com.atheris.platform.modules.pending.entity.PendingDownload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PendingDownloadRepository extends JpaRepository<PendingDownload, Long> {
    List<PendingDownload> findByStatusOrderByDiscoveredAtDesc(String status);
    List<PendingDownload> findByRegulatorIdOrderByDiscoveredAtDesc(Integer regulatorId);
    boolean existsBySourceUrl(String sourceUrl);
    @Query("SELECT p.regulatorId, COUNT(p) FROM PendingDownload p WHERE p.status = 'pending' GROUP BY p.regulatorId")
    List<Object[]> countPendingByRegulator();
}
