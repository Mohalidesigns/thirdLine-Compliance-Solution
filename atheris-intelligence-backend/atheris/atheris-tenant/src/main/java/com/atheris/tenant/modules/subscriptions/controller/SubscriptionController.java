package com.atheris.tenant.modules.subscriptions.controller;

import com.atheris.tenant.modules.subscriptions.service.SubscriptionService;
import com.atheris.tenant.modules.users.entity.User;
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
            @RequestBody Map<String, List<String>> body,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.updateRegulators(
            body.get("subscribed_regulators"), u.getUserId()));
    }

    @PostMapping("/regulators/{abbr}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Map<String, Object>> addRegulator(
            @PathVariable String abbr,
            @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.addRegulator(abbr, u.getUserId()));
    }

    @DeleteMapping("/regulators/{abbr}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Void> removeRegulator(
            @PathVariable String abbr,
            @AuthenticationPrincipal User u) {
        service.removeRegulator(abbr, u.getUserId());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/regulators/{abbr}/preferences")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Map<String, Object>> updatePreferences(
            @PathVariable String abbr,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User u) {
        @SuppressWarnings("unchecked")
        List<String> docTypes = (List<String>) body.get("document_types_override");
        return ResponseEntity.ok(service.updateRegulatorPreferences(
            abbr, (String) body.get("notification_frequency_override"), docTypes, u.getUserId()));
    }

    @DeleteMapping("/regulators/{abbr}/preferences")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<Map<String, Object>> resetPreferences(@PathVariable String abbr) {
        service.resetRegulatorPreferences(abbr);
        return ResponseEntity.ok(Map.of("regulator_abbr", abbr, "overrides_cleared", true));
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
