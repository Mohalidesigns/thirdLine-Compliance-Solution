package com.atheris.tenant.modules.license.service;

import com.atheris.tenant.modules.license.dto.*;
import com.atheris.tenant.modules.license.entity.LicenseAuditLog;
import com.atheris.tenant.modules.license.exception.LicenseActivationException;
import com.atheris.tenant.modules.license.exception.LicenseBlockedException;
import com.atheris.tenant.modules.license.exception.ProfileNotFoundException;
import com.atheris.tenant.modules.license.repository.LicenseAuditLogRepository;
import com.atheris.tenant.modules.onboarding.entity.TenantProfile;
import com.atheris.tenant.modules.onboarding.repository.TenantProfileRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class LicenseService {

    private final TenantProfileRepository profiles;
    private final LicenseAuditLogRepository auditLog;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    @Value("${atheris.platform.base-url:http://localhost:9090}")
    private String platformBaseUrl;

    @Transactional
    public LicenseStatusResponse activate(ActivateLicenseRequest req, String ipAddress, String userAgent) {
        ValidateLicenseResponse platformResp = callPlatformValidate(req.getLicenseKey(),
            req.getDeviceFingerprint(), req.getDeviceLabel(), ipAddress);

        TenantProfile profile = profiles.findByTenantId(tenantId)
            .orElseThrow(() -> new ProfileNotFoundException("Tenant profile not found"));

        if (!platformResp.isValid()) {
            auditLog.save(LicenseAuditLog.builder()
                .eventType("activation_failed")
                .licenseKey(req.getLicenseKey())
                .status(platformResp.getStatus())
                .deviceFingerprint(req.getDeviceFingerprint())
                .responseData(toJson(platformResp))
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .build());
            return toStatusResponse(profile, platformResp);
        }

        profile.setLicenseKey(req.getLicenseKey());
        profile.setLicenseStatus(platformResp.getStatus());
        profile.setLicenseActivatedAt(Instant.now());
        profile.setLicenseExpiresAt(platformResp.getExpiresAt());
        if (req.getDeviceFingerprint() != null) {
            profile.setDeviceFingerprint(req.getDeviceFingerprint());
            profile.setDeviceFingerprintProvisionedAt(Instant.now());
        }
        profile.setLicenseGracePeriodEnd(platformResp.getGracePeriodEnd());
        profiles.save(profile);

        auditLog.save(LicenseAuditLog.builder()
            .eventType("activated")
            .licenseKey(req.getLicenseKey())
            .status("active")
            .deviceFingerprint(req.getDeviceFingerprint())
            .responseData(toJson(platformResp))
            .ipAddress(ipAddress)
            .userAgent(userAgent)
            .build());

        log.info("License activated for tenant {}", tenantId);
        return toStatusResponse(profile, platformResp);
    }

    public LicenseStatusResponse getStatus() {
        Optional<TenantProfile> opt = profiles.findByTenantId(tenantId);
        if (opt.isEmpty() || opt.get().getLicenseKey() == null) {
            return LicenseStatusResponse.builder()
                .valid(false)
                .status("no_license")
                .message("No license key configured")
                .build();
        }
        TenantProfile profile = opt.get();

        ValidateLicenseResponse platformResp = callPlatformValidate(
            profile.getLicenseKey(), profile.getDeviceFingerprint(), null, null);

        if (platformResp.isValid()) {
            profile.setLicenseStatus(platformResp.getStatus());
            profile.setLicenseExpiresAt(platformResp.getExpiresAt());
            profile.setLicenseGracePeriodEnd(platformResp.getGracePeriodEnd());
            profile.setLastLicenseCheckupAt(Instant.now());
            profiles.save(profile);
        }

        return toStatusResponse(profile, platformResp);
    }

    public LicenseStatusResponse checkup() {
        Optional<TenantProfile> opt = profiles.findByTenantId(tenantId);
        if (opt.isEmpty() || opt.get().getLicenseKey() == null) {
            return LicenseStatusResponse.builder()
                .valid(false)
                .status("no_license")
                .message("No license key configured")
                .build();
        }
        TenantProfile profile = opt.get();

        ValidateLicenseResponse platformResp = callPlatformValidate(
            profile.getLicenseKey(), profile.getDeviceFingerprint(), null, null);

        profile.setLastLicenseCheckupAt(Instant.now());
        if (platformResp.isValid()) {
            profile.setLicenseStatus(platformResp.getStatus());
            profile.setLicenseExpiresAt(platformResp.getExpiresAt());
            profile.setLicenseGracePeriodEnd(platformResp.getGracePeriodEnd());
        } else {
            profile.setLicenseStatus(platformResp.getStatus());
        }
        profiles.save(profile);

        auditLog.save(LicenseAuditLog.builder()
            .eventType("checkup")
            .licenseKey(profile.getLicenseKey())
            .status(profile.getLicenseStatus())
            .responseData(toJson(platformResp))
            .build());

        log.info("License checkup for tenant {}: valid={}, status={}",
            tenantId, platformResp.isValid(), platformResp.getStatus());

        return toStatusResponse(profile, platformResp);
    }

    public void requireActiveLicense() {
        Optional<TenantProfile> opt = profiles.findByTenantId(tenantId);
        if (opt.isEmpty() || opt.get().getLicenseKey() == null) {
            throw new LicenseBlockedException("No license key configured. Activate a license first.");
        }
        TenantProfile profile = opt.get();
        String status = profile.getLicenseStatus();
        if ("revoked".equals(status) || "suspended".equals(status)) {
            throw new LicenseBlockedException("License is " + status + ". Contact admin.");
        }
        if (profile.getLicenseExpiresAt() != null
            && Instant.now().isAfter(profile.getLicenseExpiresAt())) {
            if (profile.getLicenseGracePeriodEnd() != null
                && Instant.now().isBefore(profile.getLicenseGracePeriodEnd())) {
                return;
            }
            throw new LicenseBlockedException("License has expired. System is in read-only mode.");
        }
        if ("expired".equals(status)) {
            if (profile.getLicenseGracePeriodEnd() != null
                && Instant.now().isBefore(profile.getLicenseGracePeriodEnd())) {
                return;
            }
            throw new LicenseBlockedException("License expired. System is in read-only mode.");
        }
    }

    private ValidateLicenseResponse callPlatformValidate(
            String licenseKey, String deviceFingerprint, String deviceLabel, String ipAddress) {
        try {
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("licenseKey", licenseKey);
            body.put("deviceFingerprint", deviceFingerprint);
            body.put("deviceLabel", deviceLabel);
            body.put("ipAddress", ipAddress);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<ValidateLicenseResponse> resp = restTemplate.postForEntity(
                platformBaseUrl + "/api/v1/admin/licenses/validate",
                entity, ValidateLicenseResponse.class);
            return resp.getBody();
        } catch (Exception e) {
            log.error("Failed to validate license with platform: {}", e.getMessage());
            return ValidateLicenseResponse.builder()
                .valid(false)
                .status("validation_error")
                .message("Could not reach license server: " + e.getMessage())
                .build();
        }
    }

    @Transactional
    public void deactivate() {
        TenantProfile profile = profiles.findByTenantId(tenantId)
            .orElseThrow(() -> new ProfileNotFoundException("Tenant profile not found"));
        profile.setLicenseKey(null);
        profile.setLicenseStatus("inactive");
        profile.setLicenseActivatedAt(null);
        profile.setLicenseExpiresAt(null);
        profile.setDeviceFingerprint(null);
        profile.setDeviceFingerprintProvisionedAt(null);
        profile.setLastLicenseCheckupAt(null);
        profile.setLicenseGracePeriodEnd(null);
        profiles.save(profile);
        auditLog.save(LicenseAuditLog.builder()
            .eventType("deactivated")
            .status("inactive")
            .build());
    }

    public List<LicenseAuditEntryDto> getAuditLog() {
        return auditLog.findTop50ByOrderByCreatedAtDesc().stream()
            .map(a -> LicenseAuditEntryDto.builder()
                .id(a.getId()).eventType(a.getEventType()).status(a.getStatus())
                .deviceFingerprint(a.getDeviceFingerprint()).ipAddress(a.getIpAddress())
                .createdAt(a.getCreatedAt()).build())
            .toList();
    }

    private LicenseStatusResponse toStatusResponse(TenantProfile profile, ValidateLicenseResponse platformResp) {
        return LicenseStatusResponse.builder()
            .valid(platformResp.isValid())
            .status(platformResp.getStatus() != null ? platformResp.getStatus() : profile.getLicenseStatus())
            .tier(platformResp.getTier())
            .intelligenceEnabled(platformResp.getIntelligenceEnabled() != null
                ? platformResp.getIntelligenceEnabled() : profile.getIntelligenceEnabled())
            .maxUsers(platformResp.getMaxUsers())
            .maxDevices(platformResp.getMaxDevices())
            .expiresAt(platformResp.getExpiresAt())
            .gracePeriodEnd(platformResp.getGracePeriodEnd())
            .gracePeriodDays(platformResp.getGracePeriodDays())
            .deviceRegistered(platformResp.getDeviceRegistered())
            .deviceCount(platformResp.getDeviceCount())
            .deviceLimit(platformResp.getDeviceLimit())
            .message(platformResp.getMessage())
            .lastCheckupAt(profile.getLastLicenseCheckupAt())
            .build();
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

}
