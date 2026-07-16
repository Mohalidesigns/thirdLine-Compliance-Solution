package com.atheris.compliance.tenant.backend.modules.subscriptions.controller;

import com.atheris.compliance.tenant.backend.modules.subscriptions.service.SubscriptionService;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/subscriptions")
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService service;

    @GetMapping
    public ResponseEntity<Map<String, Object>> summary() {
        return ResponseEntity.ok(service.getSummary());
    }

    @PutMapping("/regulators")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Map<String, Object>> updateRegulators(
            @RequestBody Map<String, List<Integer>> body,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.updateRegulators(
            body.get("subscribed_regulators"), u.getUserId()));
    }

    @PostMapping("/regulators/{regulatorId}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Map<String, Object>> addRegulator(
            @PathVariable Integer regulatorId,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.addRegulator(regulatorId, u.getUserId()));
    }

    @DeleteMapping("/regulators/{regulatorId}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Void> removeRegulator(
            @PathVariable Integer regulatorId,
            @AuthenticationPrincipal User u) {
        service.removeRegulator(regulatorId, u.getUserId());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/regulators/{regulatorId}/preferences")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Map<String, Object>> updatePreferences(
            @PathVariable Integer regulatorId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User u) {
        @SuppressWarnings("unchecked")
        List<String> docTypes = (List<String>) body.get("document_types_override");
        return ResponseEntity.ok(service.updateRegulatorPreferences(
            regulatorId, (String) body.get("notification_frequency_override"), docTypes, u.getUserId()));
    }

    @DeleteMapping("/regulators/{regulatorId}/preferences")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Map<String, Object>> resetPreferences(@PathVariable Integer regulatorId) {
        service.resetRegulatorPreferences(regulatorId);
        return ResponseEntity.ok(Map.of("regulator_id", regulatorId, "overrides_cleared", true));
    }

    @PutMapping("/document-types")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Void> updateDocumentTypes(
            @RequestBody Map<String, List<String>> body,
            @AuthenticationPrincipal User u) {
        service.updateDocumentTypes(body.get("subscribed_document_types"),
            body.get("notification_risk_ratings"), u.getUserId());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/notifications")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Void> updateNotificationFrequency(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User u) {
        service.updateNotificationFrequency(body.get("notification_frequency"), u.getUserId());
        return ResponseEntity.noContent().build();
    }
}
