package com.atheris.compliance.tenant.backend.modules.onboarding.controller;

import com.atheris.compliance.tenant.backend.modules.onboarding.dto.*;
import com.atheris.compliance.tenant.backend.modules.onboarding.service.OnboardingService;
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

    @PostMapping("/activate-license")
    public ResponseEntity<OnboardingStatusResponse> activateLicense(
            @Valid @RequestBody ActivateLicenseStepRequest req) {
        return ResponseEntity.ok(service.activateLicense(req));
    }

    @PostMapping("/institution")
    public ResponseEntity<OnboardingStatusResponse> saveInstitution(
            @Valid @RequestBody InstitutionDetailsRequest req) {
        return ResponseEntity.ok(service.saveInstitution(req));
    }

    @PostMapping("/intelligence-mode")
    public ResponseEntity<OnboardingStatusResponse> saveIntelligenceMode(
            @RequestBody IntelligenceModeRequest req) {
        return ResponseEntity.ok(service.saveIntelligenceMode(req));
    }

    @PostMapping("/user-setup")
    public ResponseEntity<OnboardingStatusResponse> saveUserSetup(
            @Valid @RequestBody UserSetupRequest req) {
        return ResponseEntity.ok(service.saveUserSetup(req));
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
