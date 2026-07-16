package com.atheris.platform.modules.webhooks.service;

import com.atheris.platform.modules.tenants.entity.Tenant;
import com.atheris.platform.modules.tenants.repository.TenantRepository;
import com.atheris.platform.modules.webhooks.entity.WebhookDeliveryLog;
import com.atheris.platform.modules.webhooks.repository.WebhookDeliveryLogRepository;
import com.atheris.common.Constants;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
                deliveryLog.markDelivered(log_.getDeliveryId(), resp.statusCode(), latency, Instant.now());
                log.info("Webhook delivered to tenant {} for instrument {} ({}ms)", tenantId, instrumentId, latency);
            } else {
                deliveryLog.markFailed(log_.getDeliveryId(),
                    "HTTP " + resp.statusCode(), nextRetry(0));
            }
        } catch (Exception e) {
            deliveryLog.markFailed(log_.getDeliveryId(), e.getMessage(), nextRetry(0));
            log.warn("Webhook delivery failed for tenant {}: {}", tenantId, e.getMessage());
        }
    }

    public void retryFailed(int limit) {
        deliveryLog.findDueForRetry(Instant.now()).stream().limit(limit).forEach(w -> {
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
                    if (resp.statusCode() == 200)
                        deliveryLog.markDelivered(w.getDeliveryId(), 200, 0, Instant.now());
                    else
                        deliveryLog.markFailed(w.getDeliveryId(), "HTTP " + resp.statusCode(),
                            nextRetry(w.getAttemptCount()));
                } catch (Exception e) {
                    deliveryLog.markFailed(w.getDeliveryId(), e.getMessage(),
                        nextRetry(w.getAttemptCount()));
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
