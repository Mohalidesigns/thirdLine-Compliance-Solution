package com.atheris.compliance.intelligence.backend.modules.tenants.controller;

import com.atheris.compliance.intelligence.backend.modules.licenses.entity.ApiKey;
import com.atheris.compliance.intelligence.backend.modules.licenses.entity.License;
import com.atheris.compliance.intelligence.backend.modules.licenses.repository.ApiKeyRepository;
import com.atheris.compliance.intelligence.backend.modules.licenses.repository.LicenseRepository;
import com.atheris.compliance.intelligence.backend.modules.tenants.dto.CreateTenantRequest;
import com.atheris.compliance.intelligence.backend.modules.tenants.dto.CreateTenantResponse;
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

@RestController
@RequestMapping("/api/v1/internal/tenants")
@RequiredArgsConstructor
@Slf4j
public class InternalTenantController {

    private final TenantRepository tenants;
    private final ApiKeyRepository apiKeys;
    private final LicenseRepository licenses;

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
        if (ak.getTenantId() != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Tenant already onboarded for this license"));
        }

        String webhookSecret = generateSecret(Constants.WEBHOOK_SECRET_PREFIX);

        Tenant tenant = Tenant.builder()
            .legalName(req.getLegalName())
            .shortName(req.getShortName())
            .licenceType(req.getLicenceType())
            .licenceNumber(req.getLicenceNumber())
            .address(req.getAddress())
            .contactPhone(req.getContactPhone())
            .contactEmail(req.getContactEmail())
            .ccoName(req.getCcoName())
            .ccoEmail(req.getCcoEmail())
            .techEmail(req.getTechEmail())
            .regulators(req.getRegulators())
            .productLines(req.getProductLines())
            .subscribedDocumentTypes(req.getSubscribedDocumentTypes())
            .notificationFrequency(req.getNotificationFrequency() != null
                ? req.getNotificationFrequency() : Constants.TENANT_PLAN_IMMEDIATE)
            .subscriptionTier(req.getSubscriptionTier() != null
                ? req.getSubscriptionTier() : Constants.TENANT_PLAN_STARTER)
            .webhookUrl(req.getWebhookUrl())
            .webhookSecret(webhookSecret)
            .webhookEnabled(true)
            .isActive(true)
            .onboardedAt(Instant.now())
            .build();
        tenants.save(tenant);

        ak.setTenantId(tenant.getTenantId());
        apiKeys.save(ak);

        License license = licenses.findById(ak.getLicenseId()).orElse(null);
        if (license != null) {
            license.setTenantId(tenant.getTenantId());
            licenses.save(license);
        }

        log.info("Tenant {} ({}) onboarded via self-service", req.getLegalName(), tenant.getTenantId());
        return ResponseEntity.status(HttpStatus.CREATED).body(CreateTenantResponse.builder()
            .tenantId(tenant.getTenantId())
            .webhookSecret(webhookSecret)
            .message("Tenant created successfully")
            .build());
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
