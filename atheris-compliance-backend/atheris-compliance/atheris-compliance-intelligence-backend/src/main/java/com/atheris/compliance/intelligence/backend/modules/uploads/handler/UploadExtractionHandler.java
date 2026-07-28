package com.atheris.compliance.intelligence.backend.modules.uploads.handler;

import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadRecord;
import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadStatus;
import com.atheris.compliance.intelligence.backend.modules.uploads.event.DocumentUploadedEvent;
import com.atheris.compliance.intelligence.backend.modules.uploads.event.TextExtractedEvent;
import com.atheris.compliance.intelligence.backend.modules.uploads.repository.UploadRecordRepository;
import com.atheris.compliance.intelligence.backend.shared.ocr.PdfExtractionService;
import com.atheris.compliance.intelligence.backend.shared.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

@Component
public class UploadExtractionHandler {

    private static final Logger log = LoggerFactory.getLogger(UploadExtractionHandler.class);

    private final UploadRecordRepository repo;
    private final StorageService storage;
    private final PdfExtractionService pdfExtraction;
    private final ApplicationEventPublisher events;

    public UploadExtractionHandler(UploadRecordRepository repo, StorageService storage,
                                   PdfExtractionService pdfExtraction, ApplicationEventPublisher events) {
        this.repo = repo;
        this.storage = storage;
        this.pdfExtraction = pdfExtraction;
        this.events = events;
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(DocumentUploadedEvent event) {
        UploadRecord record = repo.findById(event.uploadRecordId()).orElse(null);
        if (record == null) {
            log.error("[UploadExtraction] Upload record {} not found", event.uploadRecordId());
            return;
        }

        try {
            record.setStatus(UploadStatus.EXTRACTING);
            repo.save(record);

            byte[] pdfBytes = readS3Bytes(record.getS3Key());
            String text = pdfExtraction.extractText(pdfBytes);

            record.setExtractedText(text);
            record.setStatus(UploadStatus.EXTRACTED);
            repo.save(record);

            events.publishEvent(new TextExtractedEvent(record.getId()));
            log.info("[UploadExtraction] Extracted {} chars from upload {} ({})",
                    text.length(), record.getId(), record.getTitle());

        } catch (Exception e) {
            log.error("[UploadExtraction] Failed for upload {}: {}", record.getId(), e.getMessage(), e);
            record.setStatus(UploadStatus.FAILED);
            record.setErrorMessage(e.getMessage());
            repo.save(record);
        }
    }

    private byte[] readS3Bytes(String s3Key) throws IOException {
        try (InputStream is = storage.openReadStream(s3Key);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) {
                baos.write(buf, 0, n);
            }
            return baos.toByteArray();
        }
    }
}
