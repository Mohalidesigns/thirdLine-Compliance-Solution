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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class UploadClassificationHandler {

    private static final Logger log = LoggerFactory.getLogger(UploadClassificationHandler.class);

    private final UploadRecordRepository repo;
    private final InstrumentRepository instruments;
    private final ClassificationService classificationService;
    private final ApplicationEventPublisher events;

    public UploadClassificationHandler(UploadRecordRepository repo, InstrumentRepository instruments,
                                       ClassificationService classificationService, ApplicationEventPublisher events) {
        this.repo = repo;
        this.instruments = instruments;
        this.classificationService = classificationService;
        this.events = events;
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(TextExtractedEvent event) {
        UploadRecord record = repo.findById(event.uploadRecordId()).orElse(null);
        if (record == null) {
            log.error("[UploadClassify] Upload record {} not found", event.uploadRecordId());
            return;
        }

        if (record.getExtractedText() == null || record.getExtractedText().isBlank()) {
            log.warn("[UploadClassify] No extracted text for upload {} — marking failed", record.getId());
            record.setStatus(UploadStatus.FAILED);
            record.setErrorMessage("No text could be extracted from PDF");
            repo.save(record);
            return;
        }

        try {
            record.setStatus(UploadStatus.CLASSIFYING);
            repo.save(record);

            Instrument instrument = Instrument.builder()
                    .regulatorId(record.getRegulatorId())
                    .sourceTitle(record.getTitle())
                    .pdfUrl(record.getS3Key())
                    .pdfOcrText(record.getExtractedText())
                    .pdfHash(record.getSha256Hash())
                    .uploadSource("manual_upload")
                    .uploadedBy(record.getUserId())
                    .status("Triage")
                    .build();
            instrument = instruments.save(instrument);

            classificationService.classifyAsync(instrument.getInstrumentId(), record.getExtractedText());

            record.setStatus(UploadStatus.COMPLETED);
            record.setInstrumentId(instrument.getInstrumentId());
            repo.save(record);

            events.publishEvent(new ClassificationCompletedEvent(record.getId(), instrument.getInstrumentId()));
            log.info("[UploadClassify] Completed upload {} — instrumentId={}", record.getId(), instrument.getInstrumentId());

        } catch (Exception e) {
            log.error("[UploadClassify] Failed for upload {}: {}", record.getId(), e.getMessage(), e);
            record.setStatus(UploadStatus.FAILED);
            record.setErrorMessage(e.getMessage());
            repo.save(record);
        }
    }
}
