package com.atheris.compliance.intelligence.backend.modules.licenses.service;

import com.atheris.compliance.intelligence.backend.modules.licenses.dto.*;
import com.atheris.compliance.intelligence.backend.modules.licenses.entity.ApiKey;
import com.atheris.compliance.intelligence.backend.modules.licenses.entity.License;
import com.atheris.compliance.intelligence.backend.modules.licenses.entity.LicenseDevice;
import com.atheris.compliance.intelligence.backend.modules.licenses.exception.DeviceMismatchException;
import com.atheris.compliance.intelligence.backend.modules.licenses.exception.DeviceNotFoundException;
import com.atheris.compliance.intelligence.backend.modules.licenses.exception.LicenseNotFoundException;
import com.atheris.compliance.intelligence.backend.modules.licenses.mapper.LicenseMapper;
import com.atheris.compliance.intelligence.backend.modules.licenses.repository.ApiKeyRepository;
import com.atheris.compliance.intelligence.backend.modules.licenses.repository.LicenseDeviceRepository;
import com.atheris.compliance.intelligence.backend.modules.licenses.repository.LicenseRepository;
import com.atheris.compliance.intelligence.backend.modules.tenants.entity.Tenant;
import com.atheris.compliance.intelligence.backend.modules.tenants.repository.TenantRepository;
import static com.atheris.compliance.common.Constants.*;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class LicenseService {

    private final LicenseRepository licenses;
    private final LicenseDeviceRepository devices;
    private final LicenseKeyGenerator keyGenerator;
    private final TenantRepository tenants;
    private final LicenseMapper mapper;
    private final ApiKeyRepository apiKeys;

    @Value("${atheris.encryption-key:temporary-dev-encryption-key-change-in-prod}")
    private String encryptionKey;

    @Transactional
    public LicenseDto create(CreateLicenseRequest req) {
        if (req.getTenantId() != null) {
            tenants.findById(req.getTenantId())
                .orElseThrow(() -> new LicenseNotFoundException("Tenant not found: " + req.getTenantId()));
        }

        String licenseKey;
        do {
            licenseKey = keyGenerator.generate();
        } while (licenses.findByLicenseKey(licenseKey).isPresent());

        License license = License.builder()
            .tenantId(req.getTenantId())
            .licenseKey(licenseKey)
            .tier(req.getTier() != null ? req.getTier() : LICENSE_DEFAULT_TIER)
            .intelligenceEnabled(req.getIntelligenceEnabled() != null ? req.getIntelligenceEnabled() : true)
            .maxUsers(req.getMaxUsers() != null ? req.getMaxUsers() : 5)
            .maxDevices(req.getMaxDevices() != null ? req.getMaxDevices() : 1)
            .maxRegulators(req.getMaxRegulators())
            .maxControls(req.getMaxControls())
            .maxReturns(req.getMaxReturns())
            .maxStorageMb(req.getMaxStorageMb() != null ? req.getMaxStorageMb() : 500)
            .deviceFingerprintEnforced(req.getDeviceFingerprintEnforced() != null ? req.getDeviceFingerprintEnforced() : true)
            .status(LICENSE_INACTIVE)
            .expiresAt(req.getExpiresAt())
            .gracePeriodDays(req.getGracePeriodDays() != null ? req.getGracePeriodDays() : 7)
            .notes(req.getNotes())
            .build();

        licenses.save(license);

        String rawApiKey = generateApiKey();
        ApiKey apiKey = ApiKey.builder()
            .licenseId(license.getId())
            .keyHash(sha256(rawApiKey))
            .keyPrefix(rawApiKey.substring(0, 12))
            .encryptedKey(encrypt(rawApiKey))
            .label("default")
            .isActive(true)
            .build();
        apiKeys.save(apiKey);

        log.info("License created: {} (apiKey: {}...)", licenseKey, rawApiKey.substring(0, 12));
        return toDto(license, List.of());
    }

    @Transactional(readOnly = true)
    public LicenseDto getById(Integer id) {
        License license = licenses.findById(id)
            .orElseThrow(() -> new LicenseNotFoundException(id));
        List<LicenseDevice> deviceList = devices.findByLicenseId(id);
        return toDto(license, deviceList);
    }

    @Transactional(readOnly = true)
    public LicenseDto getByLicenseKey(String licenseKey) {
        License license = licenses.findByLicenseKey(licenseKey)
            .orElseThrow(() -> new LicenseNotFoundException(licenseKey, "key"));
        List<LicenseDevice> deviceList = devices.findByLicenseId(license.getId());
        return toDto(license, deviceList);
    }

    @Transactional(readOnly = true)
    public Page<LicenseDto> list(String status, Long tenantId, String search, Pageable pageable) {
        Specification<License> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (tenantId != null) {
                predicates.add(cb.equal(root.get("tenantId"), tenantId));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("licenseKey")), pattern),
                    cb.like(cb.lower(root.get("tier")), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<License> page = licenses.findAll(spec, pageable);
        Set<Long> tenantIds = page.getContent().stream()
            .map(License::getTenantId).collect(Collectors.toSet());
        Map<Long, String> tenantNames = tenantIds.isEmpty() ? Map.of()
            : tenants.findAllById(tenantIds).stream()
                .collect(Collectors.toMap(Tenant::getTenantId, Tenant::getLegalName));

        return page.map(l -> toDto(l, devices.findByLicenseId(l.getId()),
            tenantNames.getOrDefault(l.getTenantId(), null)));
    }

    @Transactional
    public LicenseDto update(Integer id, UpdateLicenseRequest req) {
        License license = licenses.findById(id)
            .orElseThrow(() -> new LicenseNotFoundException(id));
        mapper.updateFromRequest(req, license);
        licenses.save(license);
        return toDto(license, devices.findByLicenseId(id));
    }

    @Transactional
    public void revoke(Integer id) {
        License license = licenses.findById(id)
            .orElseThrow(() -> new LicenseNotFoundException(id));
        license.setStatus(LICENSE_REVOKED);
        licenses.save(license);
        log.info("License {} revoked for tenant {}", license.getLicenseKey(), license.getTenantId());
    }

    @Transactional
    public LicenseDto renew(Integer id, Instant newExpiry, Integer newGracePeriodDays) {
        License license = licenses.findById(id)
            .orElseThrow(() -> new LicenseNotFoundException(id));
        license.setStatus(LICENSE_ACTIVE);
        license.setExpiresAt(newExpiry);
        if (newGracePeriodDays != null) license.setGracePeriodDays(newGracePeriodDays);
        license.setGracePeriodEnd(newExpiry.plus(license.getGracePeriodDays(), ChronoUnit.DAYS));
        licenses.save(license);
        log.info("License {} renewed until {}", license.getLicenseKey(), newExpiry);
        return toDto(license, devices.findByLicenseId(id));
    }

    @Transactional
    public ValidateLicenseResponse validate(ValidateLicenseRequest req) {
        Optional<License> opt = licenses.findByLicenseKey(req.getLicenseKey());
        if (opt.isEmpty()) {
            return ValidateLicenseResponse.builder()
                .valid(false)
                .status(LICENSE_NOT_FOUND)
                .message("License key not found")
                .build();
        }
        License license = opt.get();

        String status = license.getStatus();
        Instant now = Instant.now();
        boolean expired = now.isAfter(license.getExpiresAt());
        boolean inGrace = expired && license.getGracePeriodEnd() != null && now.isBefore(license.getGracePeriodEnd());

        switch (status) {
            case LICENSE_REVOKED:
            case LICENSE_SUSPENDED:
                return ValidateLicenseResponse.builder()
                    .valid(false)
                    .status(status)
                    .message("License is " + status)
                    .build();
            case LICENSE_INACTIVE:
                return ValidateLicenseResponse.builder()
                    .valid(false)
                    .status(LICENSE_INACTIVE)
                    .message("License has not been activated")
                    .build();
        }

        if (expired && !inGrace) {
            license.setStatus(LICENSE_EXPIRED);
            licenses.save(license);
            return ValidateLicenseResponse.builder()
                .valid(false)
                .status(LICENSE_EXPIRED)
                .message("License expired on " + license.getExpiresAt())
                .build();
        }

        if (inGrace) {
            license.setStatus(LICENSE_GRACE_PERIOD);
            licenses.save(license);
        }

        Integer deviceCount = devices.countByLicenseId(license.getId());
        boolean deviceRegistered = false;

        if (license.getGracePeriodEnd() == null && license.getStatus().equals(LICENSE_ACTIVE)) {
            license.setGracePeriodEnd(license.getExpiresAt().plus(license.getGracePeriodDays(), ChronoUnit.DAYS));
        }

        boolean isFirstActivation = license.getActivatedAt() == null;

        if (req.getDeviceFingerprint() != null) {
            boolean exists = devices.existsByLicenseIdAndDeviceFingerprint(
                license.getId(), req.getDeviceFingerprint());

            if (exists) {
                deviceRegistered = true;
                LicenseDevice dev = devices.findByLicenseIdAndDeviceFingerprint(
                    license.getId(), req.getDeviceFingerprint()).orElse(null);
                if (dev == null) {
                    return ValidateLicenseResponse.builder()
                        .valid(false)
                        .status(license.getStatus())
                        .message("Device record inconsistent. Please re-register.")
                        .deviceRegistered(false)
                        .deviceCount(deviceCount)
                        .deviceLimit(license.getMaxDevices())
                        .build();
                }
                dev.setLastSeenAt(now);
                dev.setLastIpAddress(req.getIpAddress());
                devices.save(dev);
            } else {
                boolean limitEnforced = license.getDeviceFingerprintEnforced() != null
                    && license.getDeviceFingerprintEnforced();
                if (limitEnforced && deviceCount >= license.getMaxDevices()) {
                    return ValidateLicenseResponse.builder()
                        .valid(false)
                        .status(license.getStatus())
                        .tier(license.getTier())
                        .intelligenceEnabled(license.getIntelligenceEnabled())
                        .maxUsers(license.getMaxUsers())
                        .maxDevices(license.getMaxDevices())
                        .expiresAt(license.getExpiresAt())
                        .gracePeriodEnd(license.getGracePeriodEnd())
                        .gracePeriodDays(license.getGracePeriodDays())
                        .deviceRegistered(false)
                        .deviceCount(deviceCount)
                        .deviceLimit(license.getMaxDevices())
                        .message("Device limit reached (" + deviceCount + "/" + license.getMaxDevices() + "). Contact admin to add more device slots.")
                        .build();
                }
                LicenseDevice newDev = LicenseDevice.builder()
                    .licenseId(license.getId())
                    .deviceFingerprint(req.getDeviceFingerprint())
                    .deviceLabel(req.getDeviceLabel())
                    .lastSeenAt(now)
                    .lastIpAddress(req.getIpAddress())
                    .build();
                devices.save(newDev);
                deviceRegistered = true;
                deviceCount++;
            }
        }

        String apiKeyValue = null;
        if (isFirstActivation) {
            license.setActivatedAt(now);
            licenses.save(license);
            Optional<ApiKey> ak = apiKeys.findByLicenseId(license.getId());
            if (ak.isPresent()) {
                apiKeyValue = decrypt(ak.get().getEncryptedKey());
            }
        }

        return ValidateLicenseResponse.builder()
            .valid(true)
            .status(license.getStatus())
            .tier(license.getTier())
            .intelligenceEnabled(license.getIntelligenceEnabled())
            .maxUsers(license.getMaxUsers())
            .maxDevices(license.getMaxDevices())
            .expiresAt(license.getExpiresAt())
            .gracePeriodEnd(license.getGracePeriodEnd())
            .gracePeriodDays(license.getGracePeriodDays())
            .deviceRegistered(deviceRegistered)
            .deviceCount(deviceCount)
            .deviceLimit(license.getMaxDevices())
            .apiKey(apiKeyValue)
            .message("License is active")
            .build();
    }

    @Transactional
    public void removeDevice(Integer licenseId, Integer deviceId) {
        LicenseDevice dev = devices.findById(deviceId)
            .orElseThrow(() -> new DeviceNotFoundException(deviceId));
        if (!dev.getLicenseId().equals(licenseId)) {
            throw new DeviceMismatchException(deviceId, licenseId);
        }
        devices.delete(dev);
        log.info("Device {} removed from license {}", deviceId, licenseId);
    }

    @Transactional(readOnly = true)
    public LicenseStatsDto getStats() {
        List<License> allLicenses = licenses.findAll();
        Map<String, Long> byStatus = new HashMap<>();
        for (License l : allLicenses) {
            byStatus.merge(l.getStatus(), 1L, Long::sum);
        }
        long total = byStatus.values().stream().mapToLong(Long::longValue).sum();
        return LicenseStatsDto.builder()
            .total(total)
            .active(byStatus.getOrDefault(LICENSE_ACTIVE, 0L))
            .inactive(byStatus.getOrDefault(LICENSE_INACTIVE, 0L))
            .expired(byStatus.getOrDefault(LICENSE_EXPIRED, 0L))
            .revoked(byStatus.getOrDefault(LICENSE_REVOKED, 0L))
            .gracePeriod(byStatus.getOrDefault(LICENSE_GRACE_PERIOD, 0L))
            .suspended(byStatus.getOrDefault(LICENSE_SUSPENDED, 0L))
            .byStatus(byStatus)
            .build();
    }

    private String generateApiKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return "sk_atheris_" + HexFormat.of().formatHex(bytes);
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(input.getBytes()));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private String encrypt(String plaintext) {
        try {
            byte[] keyBytes = MessageDigest.getInstance("SHA-256").digest(encryptionKey.getBytes());
            SecretKeySpec key = new SecretKeySpec(keyBytes, "AES");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            byte[] iv = new byte[12];
            new SecureRandom().nextBytes(iv);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes());
            byte[] result = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, result, 0, iv.length);
            System.arraycopy(ciphertext, 0, result, iv.length, ciphertext.length);
            return Base64.getEncoder().encodeToString(result);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    private String decrypt(String encrypted) {
        try {
            byte[] keyBytes = MessageDigest.getInstance("SHA-256").digest(encryptionKey.getBytes());
            SecretKeySpec key = new SecretKeySpec(keyBytes, "AES");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            byte[] decoded = Base64.getDecoder().decode(encrypted);
            byte[] iv = new byte[12];
            System.arraycopy(decoded, 0, iv, 0, iv.length);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(decoded, iv.length, decoded.length - iv.length));
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }

    private LicenseDto toDto(License l, List<LicenseDevice> deviceList) {
        String name = tenants.findById(l.getTenantId()).map(Tenant::getLegalName).orElse(null);
        return toDto(l, deviceList, name);
    }

    private LicenseDto toDto(License l, List<LicenseDevice> deviceList, String legalName) {
        return LicenseDto.builder()
            .id(l.getId())
            .tenantId(l.getTenantId())
            .legalName(legalName)
            .licenseKey(l.getLicenseKey())
            .tier(l.getTier())
            .intelligenceEnabled(l.getIntelligenceEnabled())
            .maxUsers(l.getMaxUsers())
            .maxDevices(l.getMaxDevices())
            .maxRegulators(l.getMaxRegulators())
            .maxControls(l.getMaxControls())
            .maxReturns(l.getMaxReturns())
            .maxStorageMb(l.getMaxStorageMb())
            .deviceFingerprintEnforced(l.getDeviceFingerprintEnforced())
            .status(l.getStatus())
            .activatedAt(l.getActivatedAt())
            .expiresAt(l.getExpiresAt())
            .gracePeriodDays(l.getGracePeriodDays())
            .gracePeriodEnd(l.getGracePeriodEnd())
            .issuedBy(l.getIssuedBy())
            .notes(l.getNotes())
            .deviceCount(deviceList.size())
            .devices(deviceList.stream().map(d -> LicenseDeviceDto.builder()
                .id(d.getId())
                .deviceFingerprint(d.getDeviceFingerprint())
                .deviceLabel(d.getDeviceLabel())
                .lastSeenAt(d.getLastSeenAt())
                .lastIpAddress(d.getLastIpAddress())
                .createdAt(d.getCreatedAt())
                .build()).toList())
            .createdAt(l.getCreatedAt())
            .updatedAt(l.getUpdatedAt())
            .build();
    }
}
