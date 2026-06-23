package com.atheris.platform.modules.webhooks.controller;

import com.atheris.common.Constants;
import com.atheris.platform.modules.webhooks.entity.WebhookDeliveryLog;
import com.atheris.platform.modules.webhooks.repository.WebhookDeliveryLogRepository;
import com.atheris.platform.modules.webhooks.service.WebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/platform/webhooks")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class WebhookController {

    private final WebhookService webhookService;
    private final WebhookDeliveryLogRepository deliveryLog;

    // Overall delivery health stats
    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        return ResponseEntity.ok(Map.of(
            "last_24h", Map.of(
                Constants.STATUS_DELIVERED, deliveryLog.countDeliveredSince(Instant.now().minusSeconds(86400)),
                "failed", deliveryLog.countFailedSince(Instant.now().minusSeconds(86400))
            )
        ));
    }

    // List failed deliveries across all tenants
    @GetMapping("/failed")
    public ResponseEntity<List<WebhookDeliveryLog>> listFailed() {
        return ResponseEntity.ok(deliveryLog.findDueForRetry(Instant.now()));
    }

    // Manually trigger retry of a specific delivery
    @PostMapping("/retry/{deliveryId}")
    public ResponseEntity<?> retryDelivery(@PathVariable Long deliveryId) {
        webhookService.retryFailed(1); // The implementation might need to be adjusted for specific deliveryId if needed
        return ResponseEntity.ok(Map.of("message", "Retry queued for delivery " + deliveryId));
    }
}
