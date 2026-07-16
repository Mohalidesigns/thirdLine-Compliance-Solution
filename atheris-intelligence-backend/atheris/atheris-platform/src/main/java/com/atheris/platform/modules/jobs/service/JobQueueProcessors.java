package com.atheris.platform.modules.jobs.service;

import com.atheris.platform.modules.classification.service.ClassificationService;
import com.atheris.platform.modules.instruments.entity.Instrument;
import com.atheris.platform.modules.instruments.repository.InstrumentRepository;
import com.atheris.platform.modules.regulators.service.ScraperService;
import com.atheris.platform.modules.regulators.repository.RegulatorRepository;
import com.atheris.platform.modules.tenants.entity.Tenant;
import com.atheris.platform.modules.tenants.repository.TenantRepository;
import com.atheris.platform.modules.webhooks.service.WebhookService;
import com.atheris.common.Constants;
import com.atheris.platform.shared.ocr.PdfExtractionService;
import com.atheris.platform.shared.storage.StorageService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import java.time.Instant;
import java.util.*;

@Component
@Slf4j
@RequiredArgsConstructor
public class JobQueueProcessors {

    private static final int OCR_BATCH = 3;
    private static final int CLASSIFY_BATCH = 10;
    private static final int APPLICABILITY_BATCH = 10;
    private static final int WEBHOOK_BATCH = 20;

    private final JobQueueService jobQueue;
    private final ScraperService scraperService;
    private final PdfExtractionService pdfExtractor;
    private final ClassificationService classifier;
    private final WebhookService webhooks;
    private final RegulatorRepository regulators;
    private final TenantRepository tenants;
    private final StorageService storage;
    private final InstrumentRepository instruments;
    private final EntityManager em;

    // ── Horizon Scanner: every 15 minutes ──
    @Scheduled(fixedDelayString = "${atheris.jobs.scraper-interval-ms:900000}")
    public void runHorizonScraper() {
        log.debug("Running horizon scanner...");
        scraperService.scrapeAllDue();
    }

    // ── OCR Processor: every 2 minutes ──
    @Scheduled(fixedDelayString = "${atheris.jobs.ocr-processor-interval-ms:120000}")
    @Transactional
    public void processOcrQueue() {
        for (int i = 0; i < OCR_BATCH; i++) {
            var jobOpt = jobQueue.claimOneWithPriority(Constants.JOB_OCR, 1)
                .or(() -> jobQueue.claimOneWithPriority(Constants.JOB_OCR, 0));
            if (jobOpt.isEmpty()) break;
            var job = jobOpt.get();
            try {
                    Map<String, Object> p = job.getPayload();
                    String s3Key = (String) p.get("pdf_s3_url");
                    Long regulatorId = Long.valueOf(p.get("regulator_id").toString());
                    String title = (String) p.getOrDefault("title", "");
                    boolean backfill = Boolean.TRUE.equals(p.get("is_historical_backfill"));

                    // Download PDF from S3 and extract text
                    byte[] pdfBytes = storage.readFirstBytes(s3Key, Integer.MAX_VALUE);
                    String ocrText = pdfExtractor.extractText(pdfBytes);

                    // Create and persist instrument record
                    String sourceUrl = (String) p.getOrDefault("source_url", "");
                    if (instruments.existsBySourceUrl(sourceUrl)) {
                        log.info("OCR job {}: instrument already exists for source_url {}, skipping", job.getJobId(), sourceUrl);
                        jobQueue.markCompleted(job.getJobId());
                        continue;
                    }
                    String pdfHash = (String) p.getOrDefault("pdf_hash", "");
                    if (!pdfHash.isEmpty() && instruments.existsByPdfHash(pdfHash)) {
                        log.info("OCR job {}: instrument already exists for pdf_hash {}, skipping", job.getJobId(), pdfHash);
                        jobQueue.markCompleted(job.getJobId());
                        continue;
                    }
                    Instrument saved = instruments.save(Instrument.builder()
                        .regulatorId(regulatorId.intValue())
                        .sourceTitle(title.isEmpty() ? "Untitled" : title)
                        .pdfUrl(s3Key)
                        .pdfHash((String) p.getOrDefault("pdf_hash", ""))
                        .sourceUrl(sourceUrl)
                        .pdfOcrText(ocrText)
                        .status(Constants.INST_TRIAGE)
                        .uploadSource(backfill ? "backfill" : "scraper")
                        .isHistoricalBackfill(backfill)
                        .build());

                    jobQueue.enqueue(Constants.JOB_CLASSIFY, saved.getInstrumentId(),
                        backfill ? 0 : 1,
                        Map.of("ocr_text", ocrText, "instrument_title", title,
                               "regulator_id", regulatorId),
                        "ocr-processor");

                    jobQueue.markCompleted(job.getJobId());
                    log.info("OCR job {} done. {} chars extracted.", job.getJobId(), ocrText.length());

                } catch (Throwable e) {
                    log.error("OCR job {} failed: {}", job.getJobId(), e.getMessage());
                    em.clear();
                    jobQueue.markFailed(job.getJobId(), e.getMessage(), job.getAttemptCount());
                    TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
                }
            }
    }

    // ── Classifier: every 5 minutes ──
    @Scheduled(fixedDelayString = "${atheris.jobs.classifier-interval-ms:300000}")
    @Transactional
    public void processClassifierQueue() {
        for (int i = 0; i < CLASSIFY_BATCH; i++) {
            var jobOpt = jobQueue.claimOneWithPriority(Constants.JOB_CLASSIFY, 1)
                .or(() -> jobQueue.claimOneWithPriority(Constants.JOB_CLASSIFY, 0));
            if (jobOpt.isEmpty()) break;
            var job = jobOpt.get();
            try {
                Map<String, Object> p = job.getPayload();
                Long instrumentId = job.getSubjectId();
                String ocrText = (String) p.get("ocr_text");
                if (instrumentId == null) {
                    log.warn("Classifier job {} has null subjectId, skipping", job.getJobId());
                    jobQueue.markCompleted(job.getJobId());
                    continue;
                }
                classifier.classifyAsync(instrumentId, ocrText);
                jobQueue.markCompleted(job.getJobId());
                log.info("Classifier job {} done for instrument {}", job.getJobId(), instrumentId);
            } catch (Throwable e) {
                    log.error("Classifier job {} failed: {}", job.getJobId(), e.getMessage());
                    em.clear();
                    jobQueue.markFailed(job.getJobId(), e.getMessage(), job.getAttemptCount());
                    TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            }
        }
    }

    // ── Applicability evaluator: every 5 minutes ──
    @Scheduled(fixedDelayString = "${atheris.jobs.applicability-interval-ms:300000}")
    @Transactional
    public void processApplicabilityQueue() {
        for (int i = 0; i < APPLICABILITY_BATCH; i++) {
            var jobOpt = jobQueue.claimOne(Constants.JOB_APPLICABILITY);
            if (jobOpt.isEmpty()) break;
            var job = jobOpt.get();
            try {
                Long instrumentId = job.getSubjectId();
                List<Long> matchedTenantIds = findMatchingTenants(instrumentId);

                jobQueue.enqueue(Constants.JOB_WEBHOOK, instrumentId,
                    1, Map.of("matching_tenants", matchedTenantIds,
                              "instrument_id", instrumentId),
                    Constants.JOB_APPLICABILITY);

                jobQueue.markCompleted(job.getJobId());
                log.info("Applicability job {} done. {} tenants matched.", job.getJobId(), matchedTenantIds.size());
            } catch (Throwable e) {
                log.error("Applicability job {} failed: {}", job.getJobId(), e.getMessage());
                em.clear();
                jobQueue.markFailed(job.getJobId(), e.getMessage(), job.getAttemptCount());
                TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            }
        }
    }

    // ── Webhook sender: every 5 minutes ──
    @Scheduled(fixedDelayString = "${atheris.jobs.webhook-sender-interval-ms:300000}")
    @Transactional
    public void processWebhookQueue() {
        for (int i = 0; i < WEBHOOK_BATCH; i++) {
            var jobOpt = jobQueue.claimOne(Constants.JOB_WEBHOOK);
            if (jobOpt.isEmpty()) break;
            var job = jobOpt.get();
            try {
                Map<String, Object> p = job.getPayload();
                Long instrumentId = Long.valueOf(p.get("instrument_id").toString());
                @SuppressWarnings("unchecked")
                List<Long> tenantIds = (List<Long>) p.get("matching_tenants");

                Map<String, Object> payload = buildObligationPayload(instrumentId);
                tenantIds.forEach(tid ->
                    webhooks.deliver(tid, instrumentId, payload, Constants.WEBHOOK_EVENT_RECEIVED));

                jobQueue.markCompleted(job.getJobId());
                log.info("Webhook job {} done. Sent to {} tenants.", job.getJobId(), tenantIds.size());
            } catch (Throwable e) {
                log.error("Webhook job {} failed: {}", job.getJobId(), e.getMessage());
                em.clear();
                jobQueue.markFailed(job.getJobId(), e.getMessage(), job.getAttemptCount());
                TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            }
        }
    }

    // ── Webhook retry: every 30 minutes ──
    @Scheduled(fixedDelayString = "${atheris.jobs.webhook-retry-interval-ms:1800000}")
    public void retryFailedWebhooks() {
        log.debug("Running webhook retry...");
        webhooks.retryFailed(10);
    }

    private List<Long> findMatchingTenants(Long instrumentId) {
        // Simplified — full implementation queries instruments + tenants tables
        return tenants.findByIsActiveTrue().stream()
            .map(Tenant::getTenantId)
            .toList();
    }

    private Map<String, Object> buildObligationPayload(Long instrumentId) {
        return Map.of(
            "webhook_type", Constants.WEBHOOK_EVENT_RECEIVED,
            "webhook_id", Constants.WEBHOOK_KEY_PREFIX + Instant.now().toEpochMilli(),
            "timestamp", Instant.now().toString(),
            "obligation", Map.of("obligation_id", instrumentId)
        );
    }
}
