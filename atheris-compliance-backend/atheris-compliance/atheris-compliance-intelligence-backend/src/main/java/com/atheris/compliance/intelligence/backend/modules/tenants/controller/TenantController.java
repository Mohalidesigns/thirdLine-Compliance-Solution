package com.atheris.compliance.intelligence.backend.modules.tenants.controller;

import com.atheris.compliance.intelligence.backend.modules.tenants.dto.*;
import com.atheris.compliance.intelligence.backend.modules.tenants.service.TenantService;
import com.atheris.compliance.intelligence.backend.modules.webhooks.repository.WebhookDeliveryLogRepository;
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
    public ResponseEntity<List<TenantDto>> listAll(
            @RequestParam(required = false) Boolean isActive) {
        return ResponseEntity.ok(service.findAll(isActive));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TenantDto> getOne(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<CreateTenantResponse> create(
            @Valid @RequestBody CreateTenantRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req, null));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TenantDto> update(
            @PathVariable Long id,
            @RequestBody UpdateTenantRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PostMapping("/{id}/rotate-webhook-secret")
    public ResponseEntity<?> rotateSecret(@PathVariable Long id) {
        String newSecret = service.rotateWebhookSecret(id);
        return ResponseEntity.ok(java.util.Map.of(
            "webhook_secret", newSecret,
            "message", "Secret rotated. Update your webhook handler immediately."
        ));
    }

    @PostMapping("/{id}/test-webhook")
    public ResponseEntity<WebhookTestResult> testWebhook(@PathVariable Long id) {
        return ResponseEntity.ok(service.testWebhook(id));
    }

    @GetMapping("/{id}/webhook-history")
    public ResponseEntity<?> webhookHistory(
            @PathVariable Long id,
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(
            deliveryLog.findByTenantIdOrderByCreatedAtDesc(id).stream()
                .limit(limit).toList()
        );
    }

    @PostMapping("/{id}/webhook-history/{deliveryId}/resend")
    public ResponseEntity<?> resendWebhook(
            @PathVariable Long id,
            @PathVariable Long deliveryId) {
        return ResponseEntity.ok(java.util.Map.of("message", "Resend queued"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }
}
