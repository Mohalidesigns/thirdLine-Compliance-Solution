package com.atheris.platform.modules.regulators.service;

import com.atheris.platform.modules.instruments.entity.Instrument;
import com.atheris.platform.modules.instruments.repository.InstrumentRepository;
import com.atheris.platform.modules.jobs.service.JobQueueService;
import com.atheris.platform.modules.pending.entity.PendingDownload;
import com.atheris.platform.modules.pending.repository.PendingDownloadRepository;
import com.atheris.platform.modules.regulators.entity.Regulator;
import com.atheris.platform.modules.regulators.entity.ScraperRunLog;
import com.atheris.platform.modules.regulators.repository.RegulatorRepository;
import com.atheris.platform.modules.regulators.repository.ScraperRunLogRepository;
import com.atheris.common.Constants;
import com.atheris.platform.modules.regulators.strategy.*;
import com.atheris.platform.shared.storage.PdfTooLargeException;
import com.atheris.platform.shared.storage.StorageService;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.*;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class ScraperService {

    private final RegulatorRepository regulators;
    private final ScraperRunLogRepository scraperLogs;
    private final InstrumentRepository instruments;
    private final StorageService storage;
    private final JobQueueService jobQueue;
    private final PendingDownloadRepository pendingDownloads;
    private final HtmlScraperStrategy htmlStrategy;
    private final PlaywrightHeadlessStrategy headlessStrategy;

    private final HttpClient httpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NORMAL)
        .connectTimeout(Duration.ofSeconds(30))
        .build();

    static URI safeUri(String url) {
        try {
            return URI.create(url);
        } catch (IllegalArgumentException e) {
            try {
                java.net.URL u = new java.net.URL(url);
                String path = u.getPath() != null ? u.getPath() : "/";
                String encoded = u.getProtocol() + "://" + u.getHost()
                    + (u.getPort() > 0 ? ":" + u.getPort() : "")
                    + path.replace(" ", "%20").replace("(", "%28").replace(")", "%29")
                    + (u.getQuery() != null ? "?" + u.getQuery() : "");
                return URI.create(encoded);
            } catch (Exception ex) {
                throw new IllegalArgumentException("Malformed URL: " + url, e);
            }
        }
    }

    public void scrapeAllDue() {
        regulators.findByIsActiveTrueAndScraperEnabledTrue().forEach(r -> {
            if (isDue(r)) {
                try { scrape(r, Constants.MODE_MONITORING); }
                catch (Exception e) {
                    log.error("Scraper failed for {}: {}", r.getAbbreviation(), e.getMessage());
                    logRun(r, Constants.MODE_MONITORING, 0, 0, 0, e.getMessage());
                }
            }
        });
    }

    public ScraperRunResult scrape(Regulator regulator, String mode) {
        long start = System.currentTimeMillis();
        log.info("[{}] Scraping {} ({})", mode, regulator.getAbbreviation(), regulator.getScraperStrategy());

        List<PdfLink> found = findPdfLinks(regulator, 1);
        int newCount = 0, skipped = 0, failed = 0;
        List<String> errors = new ArrayList<>();

        for (PdfLink link : found) {
            try {
                if (instruments.existsBySourceUrl(link.getUrl())) { skipped++; continue; }
                processNewDocument(link, regulator, mode);
                newCount++;
            } catch (PdfTooLargeException e) {
                log.warn("PDF too large, skipping: {}", link.getUrl()); skipped++;
            } catch (Exception e) {
                log.error("Error processing {}: {}", link.getUrl(), e.getMessage());
                errors.add(link.getUrl() + ": " + e.getMessage()); failed++;
                try {
                    if (!pendingDownloads.existsBySourceUrl(link.getUrl())) {
                        PendingDownload pd = new PendingDownload();
                        pd.setRegulatorId(regulator.getRegulatorId());
                        pd.setSourceUrl(link.getUrl());
                        pd.setSourcePageUrl(link.getDiscoveredOnPage());
                        pd.setTitle(link.getTitle());
                        pd.setErrorMessage(e.getMessage());
                        pendingDownloads.save(pd);
                    }
                } catch (Exception e2) {
                    log.warn("Failed to save pending download record for {}: {}", link.getUrl(), e2.getMessage());
                }
            }
        }

        int duration = (int)(System.currentTimeMillis() - start);
        logRun(regulator, mode, found.size(), newCount, failed,
            errors.isEmpty() ? null : String.join("; ", errors.subList(0, Math.min(3, errors.size()))));
        int finalNewCount = newCount;
        regulators.findById(regulator.getRegulatorId()).ifPresent(r -> {
            r.setScraperLastRanAt(Instant.now());
            r.setScraperLastFound(finalNewCount);
            regulators.save(r);
        });

        log.info("[{}] Done {}. Found:{} New:{} Skipped:{} Failed:{} {}ms",
            mode, regulator.getAbbreviation(), found.size(), newCount, skipped, failed, duration);

        return ScraperRunResult.builder()
            .regulatorId(regulator.getRegulatorId())
            .regulatorAbbreviation(regulator.getAbbreviation())
            .mode(mode).foundLinks(found.size()).newDocuments(newCount)
            .skippedDocuments(skipped).failedDocuments(failed)
            .errors(errors).durationMs(duration).build();
    }

    private void processNewDocument(PdfLink link, Regulator regulator, String mode) throws Exception {
        long maxBytes = (long) regulator.getMaxPdfSizeMb() * 1024 * 1024;
        String s3Key, pdfHash;

        if (Constants.STRATEGY_HEADLESS.equals(regulator.getScraperStrategy())) {
            // Use bytes already downloaded by Playwright during scraping (passes Cloudflare)
            byte[] pdfBytes = link.getPdfBytes();
            if (pdfBytes == null)
                throw new IllegalArgumentException("Playwright download returned no PDF bytes");
            if (pdfBytes.length > maxBytes)
                throw new PdfTooLargeException("Size " + pdfBytes.length + " exceeds limit");

            // Verify PDF magic bytes before uploading
            if (pdfBytes[0] != '%' || pdfBytes[1] != 'P' || pdfBytes[2] != 'D' || pdfBytes[3] != 'F')
                throw new IllegalArgumentException("Not a valid PDF (bad magic bytes)");

            // Compute hash and upload to S3
            MessageDigest digest = MessageDigest.getInstance(Constants.DIGEST_SHA256);
            digest.update(pdfBytes);
            pdfHash = HexFormat.of().formatHex(digest.digest());
            s3Key = Constants.S3_KEY_RAW_PREFIX + regulator.getAbbreviation().toLowerCase()
                + "/" + UUID.randomUUID() + ".pdf";
            storage.streamUpload(new ByteArrayInputStream(pdfBytes), s3Key, Constants.MIME_PDF, maxBytes);
            storage.setMetadataHash(s3Key, pdfHash);
        } else {
            // HEAD request — check content-type and size before downloading
            HttpResponse<Void> head = httpClient.send(
                HttpRequest.newBuilder().uri(safeUri(link.getUrl()))
                    .method("HEAD", HttpRequest.BodyPublishers.noBody())
                    .header(Constants.HEADER_USER_AGENT, Constants.USER_AGENT).timeout(Duration.ofSeconds(10)).build(),
                HttpResponse.BodyHandlers.discarding());

            String ct = head.headers().firstValue(Constants.HEADER_CONTENT_TYPE).orElse("");
            if (!ct.toLowerCase().contains("pdf") && !ct.contains(Constants.MIME_OCTET_STREAM))
                throw new IllegalArgumentException("Not a PDF: " + ct);

            long size = head.headers().firstValueAsLong(Constants.HEADER_CONTENT_LENGTH).orElse(-1);
            if (size > maxBytes)
                throw new PdfTooLargeException("Size " + size + " exceeds limit");

            s3Key = downloadWithRetry(link.getUrl(), regulator, maxBytes);
            pdfHash = storage.getMetadataHash(s3Key);

            // Verify PDF magic bytes
            byte[] header = storage.readFirstBytes(s3Key, 4);
            if (header[0] != '%' || header[1] != 'P' || header[2] != 'D' || header[3] != 'F') {
                storage.delete(s3Key);
                throw new IllegalArgumentException("Not a valid PDF (bad magic bytes)");
            }
        }

        // Duplicate check by content hash
        if (instruments.existsByPdfHash(pdfHash)) { storage.delete(s3Key); return; }

        int priority = Constants.MODE_MONITORING.equals(mode) ? 1 : 0;
        jobQueue.enqueue("ocr_document", null, priority, Map.of(
            "regulator_id", regulator.getRegulatorId(),
            "pdf_s3_url", s3Key,
            "source_url", link.getUrl(),
            "source_page_url", link.getDiscoveredOnPage() != null ? link.getDiscoveredOnPage() : "",
            "title", link.getTitle() != null ? link.getTitle() : "",
            "pdf_hash", pdfHash,
            "is_historical_backfill", !Constants.MODE_MONITORING.equals(mode),
            "discovered_at", Instant.now().toString()
        ), "scraper-" + regulator.getAbbreviation().toLowerCase());
    }

    private String downloadWithRetry(String url, Regulator regulator, long maxBytes) {
        RetryConfig config = RetryConfig.custom()
            .maxAttempts(3)
            .waitDuration(Duration.ofSeconds(2))
            .retryExceptions(IOException.class, java.util.concurrent.TimeoutException.class)
            .ignoreExceptions(PdfTooLargeException.class, IllegalArgumentException.class)
            .build();
        return Retry.decorateCheckedSupplier(Retry.of("pdf-" + regulator.getAbbreviation(), config),
            () -> streamDownload(url, regulator, maxBytes)).unchecked().get();
    }

    private String streamDownload(String url, Regulator regulator, long maxBytes) throws Exception {
        HttpRequest.Builder req = HttpRequest.newBuilder()
            .uri(safeUri(url)).header(Constants.HEADER_USER_AGENT, Constants.USER_AGENT)
            .timeout(Duration.ofSeconds(60)).GET();
        if (regulator.getRequestHeaders() != null)
            regulator.getRequestHeaders().forEach(req::header);

        HttpResponse<InputStream> resp = httpClient.send(req.build(),
            HttpResponse.BodyHandlers.ofInputStream());
        if (resp.statusCode() >= 500) throw new IOException("HTTP " + resp.statusCode());
        if (resp.statusCode() != 200) throw new IllegalArgumentException("HTTP " + resp.statusCode());

        MessageDigest digest = MessageDigest.getInstance(Constants.DIGEST_SHA256);
        String s3Key = Constants.S3_KEY_RAW_PREFIX + regulator.getAbbreviation().toLowerCase()
            + "/" + UUID.randomUUID() + ".pdf";

        try (InputStream in = resp.body();
             java.security.DigestInputStream dis = new java.security.DigestInputStream(in, digest)) {
            storage.streamUpload(dis, s3Key, Constants.MIME_PDF, maxBytes);
        }
        String hash = HexFormat.of().formatHex(digest.digest());
        storage.setMetadataHash(s3Key, hash);
        return s3Key;
    }

    private List<PdfLink> findPdfLinks(Regulator r, int startPage) {
        if (r.getScraperStrategy() == null) return List.of();
        return switch (r.getScraperStrategy()) {
            case Constants.STRATEGY_HTML     -> htmlStrategy.findPdfLinks(r, startPage);
            case Constants.STRATEGY_HEADLESS -> headlessStrategy.findPdfLinks(r, startPage);
            default -> { log.warn("Unknown strategy: {}", r.getScraperStrategy()); yield List.of(); }
        };
    }

    private boolean isDue(Regulator r) {
        if (r.getScraperLastRanAt() == null) return true;
        Duration elapsed = Duration.between(r.getScraperLastRanAt(), Instant.now());
        return switch (r.getScraperFrequency() != null ? r.getScraperFrequency() : Constants.FREQ_DAILY) {
            case Constants.FREQ_15MIN  -> elapsed.toMinutes() >= 15;
            case Constants.FREQ_HOURLY -> elapsed.toHours() >= 1;
            case Constants.FREQ_WEEKLY -> elapsed.toDays() >= 7;
            default                    -> elapsed.toHours() >= 24;
        };
    }

    private ScraperRunLog logRun(Regulator r, String mode, int found, int newDocs, int failed, String error) {
        return scraperLogs.save(ScraperRunLog.builder()
            .regulatorId(r.getRegulatorId()).mode(mode).runAt(Instant.now())
            .documentsFound(found).newDocuments(newDocs).failedDocuments(failed)
            .status(error == null ? Constants.STATUS_SUCCESS : (failed > 0 ? Constants.STATUS_PARTIAL_FAILURE : Constants.STATUS_SUCCESS))
            .errorMessage(error).build());
    }
}
