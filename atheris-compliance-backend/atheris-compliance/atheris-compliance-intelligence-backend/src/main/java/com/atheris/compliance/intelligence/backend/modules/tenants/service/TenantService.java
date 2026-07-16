package com.atheris.compliance.intelligence.backend.modules.tenants.service;

import com.atheris.compliance.common.Constants;
import com.atheris.compliance.intelligence.backend.modules.tenants.dto.*;
import com.atheris.compliance.intelligence.backend.modules.tenants.entity.Tenant;
import com.atheris.compliance.intelligence.backend.modules.tenants.mapper.TenantMapper;
import com.atheris.compliance.intelligence.backend.modules.tenants.repository.TenantRepository;
import com.atheris.compliance.intelligence.backend.modules.webhooks.service.WebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

@Service @Slf4j @RequiredArgsConstructor
public class TenantService {

    private final TenantRepository repo;
    private final WebhookService webhooks;
    private final TenantMapper mapper;

    public List<TenantDto> findAll() {
        return repo.findAll().stream().map(mapper::toDto).toList();
    }

    public TenantDto findById(Long id) {
        return mapper.toDto(repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + id)));
    }

    @Transactional
    public CreateTenantResponse create(CreateTenantRequest req, Integer createdBy) {
        String webhookSecret = generateSecret(Constants.WEBHOOK_SECRET_PREFIX);
        String apiKey = generateSecret(Constants.API_KEY_PREFIX);

        Tenant t = Tenant.builder()
            .legalName(req.getLegalName())
            .shortName(req.getShortName())
            .licenceType(req.getLicenceType())
            .licenceNumber(req.getLicenceNumber())
            .regulators(req.getRegulators())
            .productLines(req.getProductLines())
            .subscribedDocumentTypes(req.getSubscribedDocumentTypes())
            .notificationFrequency(req.getNotificationFrequency() != null
                ? req.getNotificationFrequency() : Constants.TENANT_PLAN_IMMEDIATE)
            .ccoName(req.getCcoName())
            .ccoEmail(req.getCcoEmail())
            .techEmail(req.getTechEmail())
            .webhookUrl(req.getWebhookUrl())
            .webhookSecret(webhookSecret)
            .webhookEnabled(true)
            .subscriptionTier(req.getSubscriptionTier() != null
                ? req.getSubscriptionTier() : Constants.TENANT_PLAN_STARTER)
            .isActive(true)
            .onboardedBy(createdBy)
            .onboardedAt(Instant.now())
            .build();

        repo.save(t);
        log.info("Tenant {} ({}) onboarded.", req.getLegalName(), t.getTenantId());

        return CreateTenantResponse.builder()
            .tenantId(t.getTenantId())
            .webhookSecret(webhookSecret)  // Shown ONCE only
            .apiKey(apiKey)
            .message("Tenant created. Test your webhook before going live.")
            .build();
    }

    @Transactional
    public TenantDto update(Long id, UpdateTenantRequest req) {
        Tenant t = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + id));
        mapper.updateFromRequest(req, t);
        return mapper.toDto(repo.save(t));
    }

    @Transactional
    public String rotateWebhookSecret(Long id) {
        Tenant t = repo.findById(id)
            .orElseThrow(() -> new RuntimeException("Tenant not found: " + id));
        String newSecret = generateSecret(Constants.WEBHOOK_SECRET_PREFIX);
        t.setWebhookSecret(newSecret);
        repo.save(t);
        return newSecret;  // Shown ONCE only
    }

    @Transactional
    public void deactivate(Long id) {
        repo.findById(id).ifPresent(t -> {
            t.setIsActive(false);
            repo.save(t);
            log.info("Tenant {} deactivated.", id);
        });
    }

    public WebhookTestResult testWebhook(Long tenantId) {
        Tenant t = repo.findById(tenantId)
            .orElseThrow(() -> new RuntimeException("Tenant not found"));
        if (t.getWebhookUrl() == null)
            return WebhookTestResult.builder().delivered(false)
                .error("No webhook URL configured").build();

        long start = System.currentTimeMillis();
        try {
            webhooks.deliver(tenantId, 0L,
                Map.of("webhook_type", Constants.WEBHOOK_EVENT_PING, "message", "Atheris webhook test"),
                Constants.WEBHOOK_EVENT_PING);
            return WebhookTestResult.builder()
                .delivered(true)
                .latencyMs((int)(System.currentTimeMillis() - start))
                .build();
        } catch (Exception e) {
            return WebhookTestResult.builder()
                .delivered(false).error(e.getMessage()).build();
        }
    }

    private String generateSecret(String prefix) {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return prefix + HexFormat.of().formatHex(bytes);
    }

}
