package com.atheris.compliance.intelligence.backend.modules.pending.controller;

import com.atheris.compliance.intelligence.backend.modules.jobs.service.JobQueueService;
import com.atheris.compliance.intelligence.backend.modules.pending.entity.PendingDownload;
import com.atheris.compliance.intelligence.backend.modules.pending.repository.PendingDownloadRepository;
import com.atheris.compliance.intelligence.backend.shared.storage.StorageService;
import com.atheris.compliance.common.Constants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/pending-downloads")
public class PendingDownloadController {

    private static final Logger log = LoggerFactory.getLogger(PendingDownloadController.class);

    private final PendingDownloadRepository repo;
    private final StorageService storage;
    private final JobQueueService jobQueue;

    public PendingDownloadController(PendingDownloadRepository repo, StorageService storage, JobQueueService jobQueue) {
        this.repo = repo;
        this.storage = storage;
        this.jobQueue = jobQueue;
    }

    @GetMapping
    public List<PendingDownload> listPending(@RequestParam(defaultValue = "pending") String status) {
        return repo.findByStatusOrderByDiscoveredAtDesc(status);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PendingDownload> get(@PathVariable Long id) {
        return repo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/upload")
    @Transactional
    public ResponseEntity<?> uploadAndResolve(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {

        PendingDownload pd = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Pending download not found: " + id));

        byte[] pdfBytes;
        try {
            pdfBytes = file.getBytes();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Failed to read file: " + e.getMessage()));
        }

        // Verify PDF magic bytes
        if (pdfBytes.length < 4 || pdfBytes[0] != '%' || pdfBytes[1] != 'P'
                || pdfBytes[2] != 'D' || pdfBytes[3] != 'F') {
            return ResponseEntity.badRequest().body(Map.of("error", "Uploaded file is not a valid PDF"));
        }

        try {
            // Compute SHA-256 hash
            MessageDigest digest = MessageDigest.getInstance(Constants.DIGEST_SHA256);
            digest.update(pdfBytes);
            String pdfHash = HexFormat.of().formatHex(digest.digest());

            // Upload to S3
            String s3Key = Constants.S3_KEY_RAW_PREFIX
                    + (pd.getRegulatorId() != null ? "reg" + pd.getRegulatorId() : "unknown")
                    + "/" + UUID.randomUUID() + ".pdf";
            storage.upload(pdfBytes, s3Key, Constants.MIME_PDF);
            storage.setMetadataHash(s3Key, pdfHash);

            // Update pending download record
            pd.setS3Key(s3Key);
            pd.setStatus("uploaded");
            repo.save(pd);

            // Enqueue OCR job — same format as ScraperService.processNewDocument
            jobQueue.enqueue(Constants.JOB_OCR, null, 0, Map.of(
                    "regulator_id", pd.getRegulatorId(),
                    "pdf_s3_url", s3Key,
                    "source_url", pd.getSourceUrl(),
                    "source_page_url", pd.getSourcePageUrl() != null ? pd.getSourcePageUrl() : "",
                    "title", pd.getTitle() != null ? pd.getTitle() : "",
                    "pdf_hash", pdfHash,
                    "is_historical_backfill", false,
                    "discovered_at", Instant.now().toString()
            ), "manual-upload-pending-" + id);

            log.info("[PendingUpload] Resolved {} — PDF uploaded, OCR enqueued (s3Key={})", id, s3Key);

            return ResponseEntity.ok(Map.of(
                    "message", "File uploaded and OCR job enqueued.",
                    "pendingDownloadId", id,
                    "fileName", file.getOriginalFilename(),
                    "s3Key", s3Key
            ));

        } catch (Exception e) {
            log.error("[PendingUpload] Failed to process upload {}: {}", id, e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/skip")
    @Transactional
    public ResponseEntity<?> skip(@PathVariable Long id) {
        return repo.findById(id).map(pd -> {
            pd.setStatus("skipped");
            repo.save(pd);
            return ResponseEntity.ok(Map.of("message", "Marked as skipped."));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> stats() {
        long pending = repo.findByStatusOrderByDiscoveredAtDesc("pending").size();
        long uploaded = repo.findByStatusOrderByDiscoveredAtDesc("uploaded").size();
        long skipped = repo.findByStatusOrderByDiscoveredAtDesc("skipped").size();
        return ResponseEntity.ok(Map.of(
                "pending", pending,
                "uploaded", uploaded,
                "skipped", skipped
        ));
    }
}
