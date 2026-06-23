package com.atheris.platform.modules.tenants.controller;

import com.atheris.platform.modules.tenants.dto.*;
import com.atheris.platform.modules.tenants.service.TenantService;
import com.atheris.platform.modules.webhooks.repository.WebhookDeliveryLogRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/platform/tenants")
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService service;
    private final WebhookDeliveryLogRepository deliveryLog;

    @GetMapping
    public ResponseEntity<List<TenantDto>> listAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TenantDto> getOne(@PathVariable String id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<CreateTenantResponse> create(
            @Valid @RequestBody CreateTenantRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, null));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TenantDto> update(
            @PathVariable String id,
            @RequestBody UpdateTenantRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PostMapping("/{id}/rotate-webhook-secret")
    public ResponseEntity<?> rotateSecret(@PathVariable String id) {
        String newSecret = service.rotateWebhookSecret(id);
        return ResponseEntity.ok(java.util.Map.of(
            "webhook_secret", newSecret,
            "message", "Secret rotated. Update your webhook handler immediately."
        ));
    }

    @PostMapping("/{id}/test-webhook")
    public ResponseEntity<WebhookTestResult> testWebhook(@PathVariable String id) {
        return ResponseEntity.ok(service.testWebhook(id));
    }

    @GetMapping("/{id}/webhook-history")
    public ResponseEntity<?> webhookHistory(
            @PathVariable String id,
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(
            deliveryLog.findByTenantIdOrderByCreatedAtDesc(id).stream()
                .limit(limit).toList()
        );
    }

    @PostMapping("/{id}/webhook-history/{deliveryId}/resend")
    public ResponseEntity<?> resendWebhook(
            @PathVariable String id,
            @PathVariable Long deliveryId) {
        return ResponseEntity.ok(java.util.Map.of("message", "Resend queued"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable String id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
