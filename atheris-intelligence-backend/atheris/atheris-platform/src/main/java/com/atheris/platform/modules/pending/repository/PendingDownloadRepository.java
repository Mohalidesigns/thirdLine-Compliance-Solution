package com.atheris.platform.modules.pending.repository;

import com.atheris.platform.modules.pending.entity.PendingDownload;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PendingDownloadRepository extends JpaRepository<PendingDownload, Long> {
    List<PendingDownload> findByStatusOrderByDiscoveredAtDesc(String status);
    List<PendingDownload> findByRegulatorIdOrderByDiscoveredAtDesc(Integer regulatorId);
    boolean existsBySourceUrl(String sourceUrl);
}
