package com.atheris.tenant.modules.onboarding.controller;

import com.atheris.tenant.modules.onboarding.dto.*;
import com.atheris.tenant.modules.onboarding.service.OnboardingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardingService service;

    @GetMapping("/status")
    public ResponseEntity<OnboardingStatusResponse> getStatus() {
        return ResponseEntity.ok(service.getStatus());
    }

    @PostMapping("/institution")
    public ResponseEntity<OnboardingStatusResponse> saveInstitution(
            @Valid @RequestBody InstitutionDetailsRequest req) {
        return ResponseEntity.ok(service.saveInstitution(req));
    }

    @PostMapping("/regulators")
    public ResponseEntity<OnboardingStatusResponse> saveRegulators(
            @RequestBody RegulatorSubscriptionRequest req) {
        return ResponseEntity.ok(service.saveRegulators(req));
    }

    @PostMapping("/document-types")
    public ResponseEntity<OnboardingStatusResponse> saveDocumentTypes(
            @RequestBody DocumentTypeRequest req) {
        return ResponseEntity.ok(service.saveDocumentTypes(req));
    }

    @PostMapping("/confirm")
    public ResponseEntity<OnboardingStatusResponse> confirm(
            @RequestBody OnboardingConfirmRequest req) {
        return ResponseEntity.ok(service.confirm(req));
    }
}
