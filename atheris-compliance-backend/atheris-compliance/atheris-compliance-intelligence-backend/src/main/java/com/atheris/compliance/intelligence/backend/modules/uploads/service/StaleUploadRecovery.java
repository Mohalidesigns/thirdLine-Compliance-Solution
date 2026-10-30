package com.atheris.compliance.intelligence.backend.modules.uploads.service;

import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadRecord;
import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadStatus;
import com.atheris.compliance.intelligence.backend.modules.uploads.repository.UploadRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;

/**
 * Marks uploads that stopped mid-pipeline (backend restart, or a failure that could not be
 * recorded) as FAILED, so the tenant sees an error and can upload again instead of watching
 * "Processing…" forever. The pipeline is event driven, so nothing else would ever pick them up.
 */
@Component
public class StaleUploadRecovery {

    private static final Logger log = LoggerFactory.getLogger(StaleUploadRecovery.class);
    private static final Duration STALE_AFTER = Duration.ofMinutes(30);
    private static final EnumSet<UploadStatus> IN_FLIGHT =
            EnumSet.of(UploadStatus.PENDING, UploadStatus.EXTRACTING, UploadStatus.EXTRACTED, UploadStatus.CLASSIFYING);

    private final UploadRecordRepository repo;

    public StaleUploadRecovery(UploadRecordRepository repo) {
        this.repo = repo;
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 600_000)
    @Transactional
    public void failStaleUploads() {
        try {
            List<UploadRecord> stale = repo.findByStatusInAndUpdatedAtBefore(IN_FLIGHT, Instant.now().minus(STALE_AFTER));
            for (UploadRecord r : stale) {
                log.warn("[UploadRecovery] Upload {} stuck in {} since {} — marking failed", r.getId(), r.getStatus(), r.getUpdatedAt());
                String stage = r.getStatus().name().toLowerCase();
                r.setStatus(UploadStatus.FAILED);
                r.setErrorMessage("Processing was interrupted (stuck in " + stage + "). Upload the document again to retry.");
            }
            if (!stale.isEmpty()) repo.saveAll(stale);
        } catch (Throwable t) {
            log.error("[UploadRecovery] Failed: {}", t.getMessage(), t);
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
        }
    }
}
