package com.atheris.compliance.tenant.backend.modules.webhook;

import com.atheris.compliance.tenant.backend.modules.notifications.entity.ObligationNotification;
import com.atheris.compliance.tenant.backend.modules.notifications.repository.ObligationNotificationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class WebhookReceiverService {

    private final ObligationClassificationRepository classifications;
    private final ObligationNotificationRepository notifications;
    private final ObjectMapper mapper;

    @Value("${atheris.webhook-secret:}")
    private String webhookSecret;

    public boolean verifySignature(String body, String header) {
        if (header == null || webhookSecret == null || webhookSecret.isBlank()) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = "sha256=" + HexFormat.of().formatHex(
                mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
            return expected.equals(header);
        } catch (Exception e) {
            return false;
        }
    }

    @Transactional
    public Map<String, String> process(String rawBody, String signature, String eventId) {
        if (webhookSecret != null && !webhookSecret.isBlank() && !verifySignature(rawBody, signature)) {
            log.warn("Invalid webhook signature for event {}", eventId);
            return Map.of("error", "Invalid signature");
        }
        try {
            JsonNode payload = mapper.readTree(rawBody);
            String webhookType = payload.path("webhook_type").asText();
            log.info("Received webhook: {} (event: {})", webhookType, eventId);
            switch (webhookType) {
                case "obligation.received" -> handleReceived(payload);
                case "obligation.applicability_updated", "obligation.classification_updated" -> handleUpdate(payload, webhookType);
                case "obligation.superseded" -> handleSuperseded(payload);
                case "ping" -> log.info("Webhook ping received");
                default -> log.warn("Unknown webhook type: {}", webhookType);
            }
            return Map.of("status", "received", "webhook_id", eventId != null ? eventId : "unknown");
        } catch (Exception e) {
            log.error("Failed to process webhook {}: {}", eventId, e.getMessage());
            return Map.of("error", "Processing failed");
        }
    }

    private void handleReceived(JsonNode payload) {
        Long instrumentId = payload.path("obligation").path("obligation_id").asLong();
        if (classifications.findByInstrumentId(instrumentId).isPresent()) {
            log.info("Obligation {} already exists", instrumentId);
            return;
        }
        classifications.save(ObligationClassification.builder()
            .instrumentId(instrumentId).applicability("under_review").status("unclassified").build());
        log.info("Obligation {} added to inbox", instrumentId);
    }

    private void handleUpdate(JsonNode payload, String type) {
        Long instrumentId = payload.path("obligation_id").asLong();
        notifications.save(ObligationNotification.builder()
            .instrumentId(instrumentId).changeType(type)
            .changeSeverity(payload.path("change_severity").asText("medium"))
            .changeSummary(payload.path("change_summary").asText(""))
            .changedFields(payload.path("changes").toString())
            .status("unread").createdAt(Instant.now()).build());
    }

    private void handleSuperseded(JsonNode payload) {
        Long instrumentId = payload.path("obligation_id").asLong();
        classifications.findByInstrumentId(instrumentId).ifPresent(c -> {
            c.setStatus("superseded");
            classifications.save(c);
        });
        notifications.save(ObligationNotification.builder()
            .instrumentId(instrumentId).changeType("superseded").changeSeverity("high")
            .changeSummary("This obligation has been withdrawn and replaced.")
            .status("unread").createdAt(Instant.now()).build());
    }
}
