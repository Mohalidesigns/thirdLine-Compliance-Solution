package com.atheris.compliance.tenant.backend.modules.onboarding.controller;

import com.atheris.compliance.tenant.backend.modules.onboarding.dto.*;
import com.atheris.compliance.tenant.backend.modules.onboarding.service.OnboardingService;
import com.atheris.compliance.tenant.backend.modules.onboarding.service.SeedService;
import com.atheris.compliance.tenant.backend.modules.settings.dto.SmtpConfigRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardingService service;
    private final SeedService seedService;

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

    @PostMapping("/user-setup")
    public ResponseEntity<OnboardingStatusResponse> saveUserSetup(
            @Valid @RequestBody UserSetupRequest req) {
        return ResponseEntity.ok(service.saveUserSetup(req));
    }

    /** Try a candidate LDAP config before committing it (service-account bind only). */
    @PostMapping("/ldap/test-connection")
    public ResponseEntity<Map<String, Object>> testLdap(
            @RequestBody UserSetupRequest.LdapConfigRequest req) {
        return ResponseEntity.ok(service.testLdapConnection(req));
    }

    @PostMapping("/regulators")
    public ResponseEntity<OnboardingStatusResponse> saveRegulators(
            @RequestBody RegulatorSubscriptionRequest req) {
        return ResponseEntity.ok(service.saveRegulators(req));
    }

    @PostMapping("/toolkit-regulators")
    public ResponseEntity<OnboardingStatusResponse> saveToolkitRegulators(
            @RequestBody RegulatorSubscriptionRequest req) {
        return ResponseEntity.ok(service.saveToolkitRegulators(req));
    }

    @PostMapping("/smtp")
    public ResponseEntity<OnboardingStatusResponse> saveSmtp(
            @RequestBody SmtpConfigRequest req) {
        return ResponseEntity.ok(service.saveSmtp(req));
    }

    @PostMapping("/smtp/test")
    public ResponseEntity<Map<String, Object>> testSmtp(
            @RequestBody SmtpConfigRequest req) {
        return ResponseEntity.ok(service.testSmtp(req));
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

    @GetMapping("/seed-status")
    public ResponseEntity<SeedService.SeedStatusDto> seedStatus() {
        return ResponseEntity.ok(seedService.getStatus());
    }
}
