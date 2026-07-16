package com.atheris.platform.modules.pending.repository;

import com.atheris.platform.modules.pending.entity.PendingDownload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.List;

public interface PendingDownloadRepository extends JpaRepository<PendingDownload, Long>, JpaSpecificationExecutor<PendingDownload> {
    List<PendingDownload> findByStatusOrderByDiscoveredAtDesc(String status);
    List<PendingDownload> findByRegulatorIdOrderByDiscoveredAtDesc(Integer regulatorId);
    boolean existsBySourceUrl(String sourceUrl);
}
