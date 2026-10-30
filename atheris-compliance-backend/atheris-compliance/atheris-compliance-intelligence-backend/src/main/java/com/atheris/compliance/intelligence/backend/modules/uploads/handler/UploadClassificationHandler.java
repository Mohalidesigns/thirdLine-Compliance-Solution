package com.atheris.compliance.intelligence.backend.modules.uploads.handler;

import com.atheris.compliance.intelligence.backend.modules.classification.service.ClassificationService;
import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadRecord;
import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadStatus;
import com.atheris.compliance.intelligence.backend.modules.uploads.event.ClassificationCompletedEvent;
import com.atheris.compliance.intelligence.backend.modules.uploads.event.TextExtractedEvent;
import com.atheris.compliance.intelligence.backend.modules.uploads.repository.UploadRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class UploadClassificationHandler {

    private static final Logger log = LoggerFactory.getLogger(UploadClassificationHandler.class);

    private final UploadRecordRepository repo;
    private final InstrumentRepository instruments;
    private final ClassificationService classificationService;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate tx;

    public UploadClassificationHandler(UploadRecordRepository repo, InstrumentRepository instruments,
                                       ClassificationService classificationService, ApplicationEventPublisher events,
                                       PlatformTransactionManager txManager) {
        this.repo = repo;
        this.instruments = instruments;
        this.classificationService = classificationService;
        this.events = events;
        this.tx = new TransactionTemplate(txManager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Not @Transactional on purpose: the instrument + classification run in their own transaction
     * (rolled back on failure — ClassificationService marks it rollback-only), and the upload's
     * status is saved outside it, so a failed classification still persists FAILED instead of
     * leaving the upload "processing" forever (and the tenant's upload job with it).
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(TextExtractedEvent event) {
        UploadRecord record = repo.findById(event.uploadRecordId()).orElse(null);
        if (record == null) {
            log.error("[UploadClassify] Upload record {} not found", event.uploadRecordId());
            return;
        }

        if (record.getExtractedText() == null || record.getExtractedText().isBlank()) {
            log.warn("[UploadClassify] No extracted text for upload {} — marking failed", record.getId());
            markFailed(record.getId(), "No text could be extracted from PDF");
            return;
        }

        try {
            record.setStatus(UploadStatus.CLASSIFYING);
            record = repo.save(record);
            final Long recordId = record.getId();

            Long instrumentId = tx.execute(status -> {
                UploadRecord r = repo.findById(recordId).orElseThrow();
                Instrument instrument = instruments.save(Instrument.builder()
                        .regulatorId(r.getRegulatorId())
                        .sourceTitle(r.getTitle())
                        .pdfUrl(r.getS3Key())
                        .pdfOcrText(r.getExtractedText())
                        .pdfHash(r.getSha256Hash())
                        .uploadSource("manual_upload")
                        .uploadedBy(r.getUserId())
                        .status("Triage")
                        .build());

                classificationService.classifyAsync(instrument.getInstrumentId(), r.getExtractedText());

                r.setStatus(UploadStatus.COMPLETED);
                r.setInstrumentId(instrument.getInstrumentId());
                r.setErrorMessage(null);
                repo.save(r);
                events.publishEvent(new ClassificationCompletedEvent(r.getId(), instrument.getInstrumentId()));
                return instrument.getInstrumentId();
            });
            log.info("[UploadClassify] Completed upload {} — instrumentId={}", recordId, instrumentId);

        } catch (Throwable e) {
            Throwable root = e;
            while (root.getCause() != null && root.getCause() != root) root = root.getCause();
            String message = root.getMessage() != null ? root.getMessage() : root.getClass().getSimpleName();
            log.error("[UploadClassify] Failed for upload {}: {}", record.getId(), message, e);
            markFailed(record.getId(), "Classification failed: " + message);
        }
    }

    private void markFailed(Long recordId, String message) {
        try {
            tx.executeWithoutResult(status -> repo.findById(recordId).ifPresent(r -> {
                r.setStatus(UploadStatus.FAILED);
                r.setErrorMessage(message.length() > 1000 ? message.substring(0, 1000) : message);
                repo.save(r);
            }));
        } catch (Throwable t) {
            log.error("[UploadClassify] Could not mark upload {} failed: {}", recordId, t.getMessage(), t);
        }
    }
}
