package com.atheris.compliance.intelligence.backend.modules.webhooks.service;

import com.atheris.compliance.intelligence.backend.modules.tenants.entity.Tenant;
import com.atheris.compliance.intelligence.backend.modules.tenants.repository.TenantRepository;
import com.atheris.compliance.intelligence.backend.modules.webhooks.entity.WebhookDeliveryLog;
import com.atheris.compliance.intelligence.backend.modules.webhooks.repository.WebhookDeliveryLogRepository;
import com.atheris.compliance.common.Constants;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class WebhookService {

    private final WebhookDeliveryLogRepository deliveryLog;
    private final TenantRepository tenants;
    private final ObjectMapper mapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10)).build();

    public void deliver(Long tenantId, Long instrumentId,
                        Map<String, Object> payload, String webhookType) {
        Tenant tenant = tenants.findById(tenantId).orElse(null);
        if (tenant == null || !tenant.getIsActive() || tenant.getWebhookUrl() == null) return;

        String webhookId = Constants.WEBHOOK_KEY_PREFIX + Instant.now().toEpochMilli() + "_" + UUID.randomUUID().toString().substring(0, 8);
        String payloadJson;
        try { payloadJson = mapper.writeValueAsString(payload); }
        catch (Exception e) { log.error("Failed to serialize webhook payload", e); return; }

        String signature = hmacSha256(payloadJson, tenant.getWebhookSecret());

        WebhookDeliveryLog log_ = deliveryLog.save(WebhookDeliveryLog.builder()
            .webhookId(webhookId).tenantId(tenantId).instrumentId(instrumentId)
            .webhookType(webhookType).status(Constants.STATUS_PENDING)
            .requestPayload(payload).requestSignature(signature).build());

        try {
            long start = System.currentTimeMillis();
            HttpResponse<String> resp = httpClient.send(
                HttpRequest.newBuilder()
                    .uri(URI.create(tenant.getWebhookUrl()))
                    .header(Constants.HEADER_CONTENT_TYPE, Constants.MIME_JSON)
                    .header(Constants.WEBHOOK_SIG_HEADER, Constants.WEBHOOK_SIG_PREFIX + signature)
                    .header(Constants.WEBHOOK_EVENT_ID_HEADER, webhookId)
                    .header(Constants.WEBHOOK_TIMESTAMP_HEADER, Instant.now().toString())
                    .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                    .timeout(Duration.ofSeconds(10)).build(),
                HttpResponse.BodyHandlers.ofString());

            int latency = (int)(System.currentTimeMillis() - start);
            if (resp.statusCode() == 200) {
                deliveryLog.findById(log_.getDeliveryId()).ifPresent(w -> {
                    w.setStatus(Constants.STATUS_DELIVERED);
                    w.setResponseCode(resp.statusCode());
                    w.setDeliveryLatencyMs(latency);
                    w.setDeliveredAt(Instant.now());
                    deliveryLog.save(w);
                });
                log.info("Webhook delivered to tenant {} for instrument {} ({}ms)", tenantId, instrumentId, latency);
            } else {
                deliveryLog.findById(log_.getDeliveryId()).ifPresent(w -> {
                    w.setStatus(Constants.STATUS_FAILED);
                    w.setLastError("HTTP " + resp.statusCode());
                    w.setAttemptCount(w.getAttemptCount() != null ? w.getAttemptCount() + 1 : 1);
                    w.setNextRetryAt(nextRetry(0));
                    deliveryLog.save(w);
                });
            }
        } catch (Exception e) {
            deliveryLog.findById(log_.getDeliveryId()).ifPresent(w -> {
                w.setStatus(Constants.STATUS_FAILED);
                w.setLastError(e.getMessage());
                w.setAttemptCount(w.getAttemptCount() != null ? w.getAttemptCount() + 1 : 1);
                w.setNextRetryAt(nextRetry(0));
                deliveryLog.save(w);
            });
            log.warn("Webhook delivery failed for tenant {}: {}", tenantId, e.getMessage());
        }
    }

    public void retryFailed(int limit) {
        Specification<WebhookDeliveryLog> retrySpec = (root, query, cb) -> cb.and(
            cb.equal(root.get("status"), Constants.STATUS_FAILED),
            cb.lt(root.get("attemptCount"), root.get("maxAttempts")),
            cb.lessThan(root.get("nextRetryAt"), Instant.now())
        );
        var query = deliveryLog.findAll(retrySpec,
            org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.ASC, "nextRetryAt"));
        query.stream().limit(limit).forEach(w -> {
            tenants.findById(w.getTenantId()).ifPresent(t -> {
                if (t.getWebhookUrl() == null) return;
                try {
                    String payloadJson = mapper.writeValueAsString(w.getRequestPayload());
                    HttpResponse<String> resp = httpClient.send(
                        HttpRequest.newBuilder().uri(URI.create(t.getWebhookUrl()))
                            .header(Constants.HEADER_CONTENT_TYPE, Constants.MIME_JSON)
                            .header(Constants.WEBHOOK_SIG_HEADER, Constants.WEBHOOK_SIG_PREFIX + w.getRequestSignature())
                            .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                            .timeout(Duration.ofSeconds(10)).build(),
                        HttpResponse.BodyHandlers.ofString());
                    if (resp.statusCode() == 200) {
                        deliveryLog.findById(w.getDeliveryId()).ifPresent(wl -> {
                            wl.setStatus(Constants.STATUS_DELIVERED);
                            wl.setResponseCode(200);
                            wl.setDeliveryLatencyMs(0);
                            wl.setDeliveredAt(Instant.now());
                            deliveryLog.save(wl);
                        });
                    } else {
                        deliveryLog.findById(w.getDeliveryId()).ifPresent(wl -> {
                            wl.setStatus(Constants.STATUS_FAILED);
                            wl.setLastError("HTTP " + resp.statusCode());
                            wl.setAttemptCount(wl.getAttemptCount() != null ? wl.getAttemptCount() + 1 : 1);
                            wl.setNextRetryAt(nextRetry(wl.getAttemptCount()));
                            deliveryLog.save(wl);
                        });
                    }
                } catch (Exception e) {
                    deliveryLog.findById(w.getDeliveryId()).ifPresent(wl -> {
                        wl.setStatus(Constants.STATUS_FAILED);
                        wl.setLastError(e.getMessage());
                        wl.setAttemptCount(wl.getAttemptCount() != null ? wl.getAttemptCount() + 1 : 1);
                        wl.setNextRetryAt(nextRetry(wl.getAttemptCount()));
                        deliveryLog.save(wl);
                    });
                }
            });
        });
    }

    private Instant nextRetry(int attempt) {
        return Instant.now().plus(Constants.RETRY_BACKOFF[Math.min(attempt, Constants.RETRY_BACKOFF.length - 1)], ChronoUnit.MINUTES);
    }

    private String hmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance(Constants.HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), Constants.HMAC_ALGORITHM));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new RuntimeException("HMAC failed", e); }
    }
}
