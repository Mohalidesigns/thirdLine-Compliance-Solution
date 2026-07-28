package com.atheris.compliance.intelligence.backend.modules.uploads.handler;

import com.atheris.compliance.intelligence.backend.modules.uploads.event.ClassificationCompletedEvent;
import com.atheris.compliance.intelligence.backend.modules.uploads.repository.UploadRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class UploadCompletionHandler {

    private static final Logger log = LoggerFactory.getLogger(UploadCompletionHandler.class);

    private final UploadRecordRepository repo;

    public UploadCompletionHandler(UploadRecordRepository repo) {
        this.repo = repo;
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(ClassificationCompletedEvent event) {
        var record = repo.findById(event.uploadRecordId()).orElse(null);
        if (record == null) {
            log.error("[UploadComplete] Upload record {} not found", event.uploadRecordId());
            return;
        }
        log.info("[UploadComplete] Upload {} completed — instrument {} is ready",
                record.getId(), event.instrumentId());
    }
}
