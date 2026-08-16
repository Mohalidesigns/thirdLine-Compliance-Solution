package com.atheris.compliance.intelligence.backend.modules.tenants.controller;

import com.atheris.compliance.intelligence.backend.modules.licenses.entity.ApiKey;
import com.atheris.compliance.intelligence.backend.modules.licenses.entity.License;
import com.atheris.compliance.intelligence.backend.modules.licenses.repository.ApiKeyRepository;
import com.atheris.compliance.intelligence.backend.modules.licenses.repository.LicenseRepository;
import com.atheris.compliance.intelligence.backend.modules.tenants.dto.CreateTenantRequest;
import com.atheris.compliance.intelligence.backend.modules.tenants.dto.CreateTenantResponse;
import com.atheris.compliance.intelligence.backend.modules.tenants.dto.ProvisionTenantRequest;
import com.atheris.compliance.intelligence.backend.modules.tenants.entity.Tenant;
import com.atheris.compliance.intelligence.backend.modules.tenants.repository.TenantRepository;
import com.atheris.compliance.common.Constants;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/internal/tenants")
@RequiredArgsConstructor
@Slf4j
public class InternalTenantController {

    private final TenantRepository tenants;
    private final ApiKeyRepository apiKeys;
    private final LicenseRepository licenses;

    /**
     * Lightweight self-provisioning. A tenant's first interaction is activating a license key.
     * This endpoint creates the platform Tenant shell from the license key and returns the
     * platform-assigned tenant ID, so the tenant backend never needs its own numeric ID from config.
     * Idempotent: a second call returns the already-provisioned tenant.
     */
    @PostMapping("/provision")
    public ResponseEntity<?> provision(@Valid @RequestBody ProvisionTenantRequest req) {
        Optional<License> licOpt = licenses.findByLicenseKey(req.getLicenseKey());
        if (licOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "License key not found"));
        }
        License license = licOpt.get();

        Optional<ApiKey> akOpt = apiKeys.findByLicenseId(license.getId());
        if (akOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "No API key provisioned for this license"));
        }
        ApiKey ak = akOpt.get();

        if (ak.getTenantId() != null) {
            Optional<Tenant> existing = tenants.findById(ak.getTenantId());
            if (existing.isPresent()) {
                return ResponseEntity.ok(CreateTenantResponse.builder()
                    .tenantId(existing.get().getTenantId())
                    .webhookSecret(existing.get().getWebhookSecret())
                    .message("Tenant already provisioned")
                    .build());
            }
        }

        String webhookSecret = generateSecret(Constants.WEBHOOK_SECRET_PREFIX);
        // legalName is NOT NULL on the schema; a full profile arrives at onboard/confirm.
        Tenant tenant = Tenant.builder()
            .legalName(req.getLicenseKey())
            .licenceType(license.getTier())
            .webhookSecret(webhookSecret)
            .webhookEnabled(true)
            .isActive(true)
            .onboardedAt(Instant.now())
            .build();
        tenants.save(tenant);

        ak.setTenantId(tenant.getTenantId());
        apiKeys.save(ak);
        license.setTenantId(tenant.getTenantId());
        licenses.save(license);

        log.info("Tenant provisioned via license {} -> tenant {}", req.getLicenseKey(), tenant.getTenantId());
        return ResponseEntity.status(HttpStatus.CREATED).body(CreateTenantResponse.builder()
            .tenantId(tenant.getTenantId())
            .webhookSecret(webhookSecret)
            .message("Tenant provisioned successfully")
            .build());
    }

    @PostMapping("/onboard")
    public ResponseEntity<?> onboard(@Valid @RequestBody CreateTenantRequest req,
                                      @RequestHeader("X-Api-Key") String rawApiKey) {
        String hash = sha256(rawApiKey);
        var opt = apiKeys.findByKeyHash(hash);
        if (opt.isEmpty() || !Boolean.TRUE.equals(opt.get().getIsActive())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid API key"));
        }

        ApiKey ak = opt.get();
        Tenant tenant;
        boolean newlyCreated;
        if (ak.getTenantId() != null) {
            tenant = tenants.findById(ak.getTenantId()).orElse(null);
            newlyCreated = false;
        } else {
            tenant = null;
            newlyCreated = true;
        }

        if (tenant == null) {
            tenant = Tenant.builder()
                .webhookSecret(generateSecret(Constants.WEBHOOK_SECRET_PREFIX))
                .webhookEnabled(true)
                .isActive(true)
                .onboardedAt(Instant.now())
                .build();
        }

        applyProfile(tenant, req);
        tenants.save(tenant);

        if (newlyCreated) {
            ak.setTenantId(tenant.getTenantId());
            apiKeys.save(ak);
            License license = licenses.findById(ak.getLicenseId()).orElse(null);
            if (license != null) {
                license.setTenantId(tenant.getTenantId());
                licenses.save(license);
            }
        }

        log.info("Tenant {} ({}) {} via self-service", req.getLegalName(), tenant.getTenantId(),
            newlyCreated ? "onboarded" : "updated");
        return ResponseEntity.status(HttpStatus.CREATED).body(CreateTenantResponse.builder()
            .tenantId(tenant.getTenantId())
            .webhookSecret(tenant.getWebhookSecret())
            .message("Tenant " + (newlyCreated ? "created" : "updated") + " successfully")
            .build());
    }

    private void applyProfile(Tenant tenant, CreateTenantRequest req) {
        tenant.setLegalName(req.getLegalName());
        tenant.setShortName(req.getShortName());
        tenant.setLicenceType(req.getLicenceType());
        tenant.setLicenceNumber(req.getLicenceNumber());
        tenant.setAddress(req.getAddress());
        tenant.setContactPhone(req.getContactPhone());
        tenant.setContactEmail(req.getContactEmail());
        tenant.setCcoName(req.getCcoName());
        tenant.setCcoEmail(req.getCcoEmail());
        tenant.setTechEmail(req.getTechEmail());
        tenant.setRegulators(req.getRegulators());
        tenant.setProductLines(req.getProductLines());
        tenant.setSubscribedDocumentTypes(req.getSubscribedDocumentTypes());
        tenant.setNotificationFrequency(req.getNotificationFrequency() != null
            ? req.getNotificationFrequency() : Constants.TENANT_PLAN_IMMEDIATE);
        tenant.setSubscriptionTier(req.getSubscriptionTier() != null
            ? req.getSubscriptionTier() : Constants.TENANT_PLAN_STARTER);
        tenant.setWebhookUrl(req.getWebhookUrl());
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(input.getBytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String generateSecret(String prefix) {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return prefix + HexFormat.of().formatHex(bytes);
    }
}
