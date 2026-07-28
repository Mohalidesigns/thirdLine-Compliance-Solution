package com.atheris.compliance.intelligence.backend.modules.uploads.service;

import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadRecord;
import com.atheris.compliance.intelligence.backend.modules.uploads.entity.UploadStatus;
import com.atheris.compliance.intelligence.backend.modules.uploads.event.DocumentUploadedEvent;
import com.atheris.compliance.intelligence.backend.modules.uploads.repository.UploadRecordRepository;
import com.atheris.compliance.intelligence.backend.shared.exception.DuplicateUploadException;
import com.atheris.compliance.intelligence.backend.shared.exception.InvalidFileException;
import com.atheris.compliance.intelligence.backend.shared.exception.UploadException;
import com.atheris.compliance.intelligence.backend.shared.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class UploadIngestionService {

    private static final Logger log = LoggerFactory.getLogger(UploadIngestionService.class);

    private final UploadRecordRepository repo;
    private final StorageService storage;
    private final ApplicationEventPublisher events;

    public UploadIngestionService(UploadRecordRepository repo, StorageService storage, ApplicationEventPublisher events) {
        this.repo = repo;
        this.storage = storage;
        this.events = events;
    }

    @Transactional
    public UploadRecord ingest(MultipartFile file, String title, Integer regulatorId,
                               String documentType, Integer userId, Integer tenantId) {
        byte[] pdfBytes;
        try {
            pdfBytes = file.getBytes();
        } catch (Exception e) {
            throw new UploadException("FILE_READ_ERROR", "Failed to read uploaded file", e);
        }

        if (pdfBytes.length < 4 || pdfBytes[0] != '%' || pdfBytes[1] != 'P'
                || pdfBytes[2] != 'D' || pdfBytes[3] != 'F') {
            throw new InvalidFileException("Uploaded file is not a valid PDF");
        }

        String sha256Hash;
        try {
            MessageDigest digest = MessageDigest.getInstance(Constants.DIGEST_SHA256);
            digest.update(pdfBytes);
            sha256Hash = HexFormat.of().formatHex(digest.digest());
        } catch (Exception e) {
            throw new UploadException("HASH_ERROR", "Failed to compute file hash", e);
        }

        var existing = repo.findBySha256Hash(sha256Hash);
        if (existing.isPresent()) {
            log.warn("Duplicate upload detected (hash={}): {}", sha256Hash, title);
            throw new DuplicateUploadException(sha256Hash, title);
        }

        String regDir = regulatorId != null ? "reg" + regulatorId : "unclassified";
        String s3Key = Constants.S3_KEY_RAW_PREFIX
                + "manual/" + regDir + "/"
                + UUID.randomUUID() + ".pdf";
        storage.upload(pdfBytes, s3Key, Constants.MIME_PDF);
        storage.setMetadataHash(s3Key, sha256Hash);

        UploadRecord record = new UploadRecord();
        record.setOriginalFilename(file.getOriginalFilename());
        record.setTitle(title);
        record.setRegulatorId(regulatorId);
        record.setDocumentType(documentType);
        record.setSha256Hash(sha256Hash);
        record.setS3Key(s3Key);
        record.setStatus(UploadStatus.PENDING);
        record.setUserId(userId);
        record.setTenantId(tenantId);
        record = repo.save(record);

        events.publishEvent(new DocumentUploadedEvent(record.getId()));
        log.info("[UploadIngestion] Created upload record {} — title={}, regulatorId={}, s3Key={}",
                record.getId(), title, regulatorId, s3Key);

        return record;
    }
}
