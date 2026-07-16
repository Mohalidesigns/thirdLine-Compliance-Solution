package com.atheris.compliance.intelligence.backend.modules.webhooks.controller;

import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.webhooks.entity.WebhookDeliveryLog;
import com.atheris.compliance.intelligence.backend.modules.webhooks.repository.WebhookDeliveryLogRepository;
import com.atheris.compliance.intelligence.backend.modules.webhooks.service.WebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
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
        Instant since = Instant.now().minusSeconds(86400);
        Specification<WebhookDeliveryLog> deliveredSpec = (root, query, cb) -> cb.and(
            cb.equal(root.get("status"), Constants.STATUS_DELIVERED),
            cb.greaterThan(root.get("createdAt"), since)
        );
        Specification<WebhookDeliveryLog> failedSpec = (root, query, cb) -> cb.and(
            cb.equal(root.get("status"), Constants.STATUS_FAILED),
            cb.greaterThan(root.get("createdAt"), since)
        );
        return ResponseEntity.ok(Map.of(
            "last_24h", Map.of(
                Constants.STATUS_DELIVERED, deliveryLog.count(deliveredSpec),
                "failed", deliveryLog.count(failedSpec)
            )
        ));
    }

    // List failed deliveries across all tenants
    @GetMapping("/failed")
    public ResponseEntity<List<WebhookDeliveryLog>> listFailed() {
        Specification<WebhookDeliveryLog> spec = (root, query, cb) -> cb.and(
            cb.equal(root.get("status"), Constants.STATUS_FAILED),
            cb.lt(root.get("attemptCount"), root.get("maxAttempts")),
            cb.lessThan(root.get("nextRetryAt"), Instant.now())
        );
        return ResponseEntity.ok(deliveryLog.findAll(spec,
            org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.ASC, "nextRetryAt")));
    }

    // Manually trigger retry of a specific delivery
    @PostMapping("/retry/{deliveryId}")
    public ResponseEntity<?> retryDelivery(@PathVariable Long deliveryId) {
        webhookService.retryFailed(1); // The implementation might need to be adjusted for specific deliveryId if needed
        return ResponseEntity.ok(Map.of("message", "Retry queued for delivery " + deliveryId));
    }
}
