package com.atheris.compliance.tenant.backend.modules.onboarding.service;

import com.atheris.compliance.tenant.backend.modules.license.dto.LicenseStatusResponse;
import com.atheris.compliance.tenant.backend.modules.license.exception.LicenseActivationException;
import com.atheris.compliance.tenant.backend.modules.license.exception.ProfileNotFoundException;
import com.atheris.compliance.tenant.backend.modules.license.service.LicenseService;
import com.atheris.compliance.tenant.backend.modules.ldap.dto.LdapSettings;
import com.atheris.compliance.tenant.backend.modules.ldap.service.LdapAuthService;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationSyncService;
import com.atheris.compliance.tenant.backend.modules.obligations.service.RegulationSeedService;
import com.atheris.compliance.tenant.backend.modules.onboarding.dto.*;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulatorPreference;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorPreferenceRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.modules.users.entity.User;
import com.atheris.compliance.tenant.backend.modules.users.repository.UserRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import com.atheris.compliance.tenant.backend.shared.util.AppRole;
import com.atheris.compliance.tenant.backend.shared.util.CryptoUtil;
import com.atheris.compliance.tenant.backend.shared.util.NotificationConstants;
import static com.atheris.compliance.common.Constants.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class OnboardingService {

    private final TenantProfileRepository profiles;
    private final TenantRegulatorPreferenceRepository regPrefs;
    private final TenantRegulatorRepository tenantRegulatorRepo;
    private final RegulatorRecommendationService recommendationService;
    private final LicenseService licenseService;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final CryptoUtil crypto;
    private final PlatformApiClient platformApi;
    private final ObligationSyncService syncService;
    private final RegulationSeedService regulationSeedService;
    private final TenantIdentityService tenantIdentity;
    private final SeedService seedService;
    private final LdapAuthService ldapAuth;

    /** users.invite_status — an onboarded identity is usable at once; an invited one is not. */
    private static final String ACTIVE = "active";
    private static final String PENDING = "pending";

    public OnboardingStatusResponse getStatus() {
        List<RegulatorSummary> regulators = platformApi.fetchRegulators();
        return tenantIdentity.currentProfile()
            .map(p -> {
                Integer step = p.getOnboardingStep();
                boolean completed = p.getOnboardingCompletedAt() != null;
                Integer nextStep = computeNextStep(step, completed);
                return OnboardingStatusResponse.builder()
                    .onboardingCompleted(completed)
                    .currentStep(step)
                    .nextStep(nextStep)
                    .legalName(p.getLegalName())
                    .licenseStatus(p.getLicenseStatus())
                    .authType(p.getAuthType())
                    .subscribedRegulators(p.getSubscribedRegulators())
                    .subscribedDocumentTypes(p.getSubscribedDocumentTypes())
                    .availableRegulators(regulators)
                    .build();
            })
            .orElse(resultWithRegulators(regulators));
    }

    private OnboardingStatusResponse resultWithRegulators(List<RegulatorSummary> regulators) {
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(0).nextStep(1)
            .availableRegulators(regulators)
            .build();
    }

    private Integer computeNextStep(Integer step, boolean completed) {
        if (completed) return 6;
        if (step == null || step == 0) return 1;
        if (step == 1) return 2;
        if (step == 2) return 3;
        if (step == 3) return 4;
        if (step == 4) return 5;
        return 6;
    }

    @Transactional
    public OnboardingStatusResponse activateLicense(ActivateLicenseStepRequest req) {
        LicenseStatusResponse licenseResp = licenseService.activate(
            toActivateReq(req), null, null);

        if (!licenseResp.isValid()) {
            throw new LicenseActivationException(licenseResp.getMessage());
        }

        TenantProfile p = tenantIdentity.currentProfile()
            .orElseThrow(() -> new ProfileNotFoundException("Tenant profile not provisioned after license activation"));
        p.setOnboardingStep(1);
        profiles.save(p);

        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(1).nextStep(2)
            .licenseStatus(LICENSE_ACTIVE)
            .build();
    }

    @Transactional
    public OnboardingStatusResponse saveInstitution(InstitutionDetailsRequest req) {
        TenantProfile p = getProfile();
        p.setLegalName(req.getLegalName());
        p.setAddress(req.getAddress());
        p.setContactPhone(req.getContactPhone());
        p.setContactEmail(req.getContactEmail());
        p.setOnboardingStep(2);
        profiles.save(p);
        List<RegulatorSummary> regulators = platformApi.fetchRegulators();
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(2).nextStep(3)
            .availableRegulators(regulators)
            .licenseStatus(p.getLicenseStatus())
            .legalName(req.getLegalName()).build();
    }

    @Transactional
    public OnboardingStatusResponse saveUserSetup(UserSetupRequest req) {
        TenantProfile p = getProfile();
        boolean ldap = "ldap".equalsIgnoreCase(req.getAuthType());
        p.setAuthType(ldap ? "ldap" : "local");

        if (ldap) {
            p.setLdapConfig(encryptLdapConfig(req.getLdapConfig()));
            // A local tenant-admin with a password so the tenant can always get in if the
            // directory is unavailable (break-glass). Flagged so the UI can mark it.
            if (req.getBreakGlassAdmin() != null) {
                User admin = upsertUser(
                    req.getBreakGlassAdmin().getEmail(), req.getBreakGlassAdmin().getFullName(),
                    AppRole.TENANT_ADMIN, passwordEncoder.encode(req.getBreakGlassAdmin().getPassword()),
                    ACTIVE);
                admin.setIsBreakGlass(true);
                users.save(admin);
            }
        } else if (req.getLocalAdmin() != null) {
            upsertUser(req.getLocalAdmin().getEmail(), req.getLocalAdmin().getFullName(),
                AppRole.TENANT_ADMIN, passwordEncoder.encode(req.getLocalAdmin().getPassword()), ACTIVE);
        }

        // Provision the CCO and Analyst identities for both auth types. LDAP users get no
        // local password — the directory authenticates them; local users are invited (pending).
        if (req.getSeedUsers() != null) {
            for (UserSetupRequest.SeededUser s : req.getSeedUsers()) {
                String role = normalizeRole(s.getRole());
                if (role == null) continue;
                String passwordHash = ldap ? null
                    : (s.getPassword() != null && !s.getPassword().isBlank()
                        ? passwordEncoder.encode(s.getPassword()) : null);
                // LDAP identities are immediately able to sign in; a local user with a
                // password too. A local user without one awaits an invite.
                String inviteStatus = (ldap || passwordHash != null) ? ACTIVE : PENDING;
                User u = upsertUser(s.getEmail(), s.getFullName(), role, passwordHash, inviteStatus);
                // The CCO identity is the single source of the profile's CCO contact.
                if (AppRole.CCO.equals(role)) {
                    p.setCcoName(s.getFullName());
                    p.setCcoEmail(s.getEmail().toLowerCase().trim());
                }
            }
        }

        p.setOnboardingStep(3);
        profiles.save(p);
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(3).nextStep(4)
            .authType(p.getAuthType())
            .licenseStatus(p.getLicenseStatus())
            .legalName(p.getLegalName()).build();
    }

    /** Create the user if new; otherwise update name/role and (when supplied) password. */
    private User upsertUser(String rawEmail, String fullName, String role, String passwordHash, String inviteStatus) {
        String email = rawEmail.toLowerCase().trim();
        User u = users.findByEmail(email).orElseGet(() -> User.builder()
            .email(email).isActive(true).emailVerified(true).build());
        u.setFullName(fullName);
        u.setRole(role);
        if (passwordHash != null) u.setPasswordHash(passwordHash);
        u.setInviteStatus(inviteStatus);
        return users.save(u);
    }

    private static String normalizeRole(String role) {
        if (role == null) return null;
        return switch (role.trim().toUpperCase()) {
            case "CCO" -> AppRole.CCO;
            case "ANALYST" -> AppRole.ANALYST;
            case "TENANT_ADMIN", "ADMIN" -> AppRole.TENANT_ADMIN;
            case "AUDITOR" -> AppRole.AUDITOR;
            default -> null;
        };
    }

    /** Store the LDAP config with the bind password encrypted at rest. */
    private Map<String, Object> encryptLdapConfig(UserSetupRequest.LdapConfigRequest cfg) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("url", cfg.getUrl());
        m.put("bindDn", cfg.getBindDn());
        m.put("bindPassword", crypto.encrypt(cfg.getBindPassword()));
        m.put("userSearchBase", cfg.getUserSearchBase());
        m.put("userSearchFilterAttribute",
            cfg.getUserSearchFilterAttribute() != null ? cfg.getUserSearchFilterAttribute() : "mail");
        m.put("fullNameAttribute",
            cfg.getFullNameAttribute() != null ? cfg.getFullNameAttribute() : "cn");
        return m;
    }

    /** Bind with the candidate service account to validate an LDAP config before saving it. */
    public Map<String, Object> testLdapConnection(UserSetupRequest.LdapConfigRequest cfg) {
        if (cfg == null || cfg.getUrl() == null || cfg.getBindDn() == null
                || cfg.getBindPassword() == null || cfg.getUserSearchBase() == null) {
            return Map.of("ok", false, "message", "URL, bind DN, bind password and user search base are all required");
        }
        LdapSettings settings = LdapSettings.builder()
            .url(cfg.getUrl()).bindDn(cfg.getBindDn()).bindPassword(cfg.getBindPassword())
            .userSearchBase(cfg.getUserSearchBase())
            .userSearchFilterAttribute(cfg.getUserSearchFilterAttribute())
            .fullNameAttribute(cfg.getFullNameAttribute()).build();
        LdapAuthService.LdapResult r = ldapAuth.testConnection(settings);
        return Map.of("ok", r.ok(), "message", r.message());
    }

    @Transactional
    public OnboardingStatusResponse saveRegulators(RegulatorSubscriptionRequest req) {
        TenantProfile p = getProfile();
        p.setOnboardingStep(4);
        profiles.save(p);

        Long tid = tenantIdentity.currentTenantId();
        List<Integer> selectedIds = req.getSubscribedRegulators();

        if (Boolean.TRUE.equals(p.getAutoSubscribeRegulators()) || selectedIds == null || selectedIds.isEmpty()) {
            List<RegulatorSummary> allRegs = platformApi.fetchRegulators();
            List<TenantRegulator> existing = tenantRegulatorRepo.findByTenantIdAndIsActiveTrue(tid);
            List<Integer> existingIds = existing.stream()
                .map(TenantRegulator::getPlatformRegulatorId)
                .filter(Objects::nonNull)
                .toList();

            for (RegulatorSummary summary : allRegs) {
                if (existingIds.contains(summary.getRegulatorId())) continue;
                tenantRegulatorRepo.save(TenantRegulator.builder()
                    .tenantId(tid)
                    .name(summary.getName())
                    .abbreviation(summary.getAbbreviation())
                    .platformRegulatorId(summary.getRegulatorId())
                    .isActive(true)
                    .build());
            }
            selectedIds = allRegs.stream().map(RegulatorSummary::getRegulatorId).toList();
        }

        p.setSubscribedRegulators(selectedIds);
        profiles.save(p);

        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(4).nextStep(5)
            .licenseStatus(p.getLicenseStatus())
            .subscribedRegulators(selectedIds).build();
    }

    @Transactional
    public OnboardingStatusResponse saveDocumentTypes(DocumentTypeRequest req) {
        TenantProfile p = getProfile();
        p.setSubscribedDocumentTypes(List.of("circulars", "guidelines", "directives", "regulations", "standards", "frameworks"));
        p.setNotificationRiskRatings(List.of(NotificationConstants.SEVERITY_HIGH, NotificationConstants.SEVERITY_MEDIUM, NotificationConstants.SEVERITY_LOW));
        p.setOnboardingStep(5);
        profiles.save(p);
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(5).nextStep(6)
            .licenseStatus(p.getLicenseStatus())
            .subscribedDocumentTypes(p.getSubscribedDocumentTypes()).build();
    }

    @Transactional
    public OnboardingStatusResponse confirm(OnboardingConfirmRequest req) {
        TenantProfile p = getProfile();
        if (req.getWebhookUrl() != null) p.setWebhookUrl(req.getWebhookUrl());
        p.setIsActive(true);
        p.setOnboardingCompletedAt(Instant.now());
        p.setOnboardingStep(6);

        if (p.getSubscribedRegulators() == null || p.getSubscribedRegulators().isEmpty()) {
            List<RegulatorSummary> allRegs = platformApi.fetchRegulators();
            Long tid = tenantIdentity.currentTenantId();
            List<TenantRegulator> existing = tenantRegulatorRepo.findByTenantIdAndIsActiveTrue(tid);
            List<Integer> existingIds = existing.stream()
                .map(TenantRegulator::getPlatformRegulatorId)
                .filter(Objects::nonNull)
                .toList();
            for (RegulatorSummary summary : allRegs) {
                if (existingIds.contains(summary.getRegulatorId())) continue;
                tenantRegulatorRepo.save(TenantRegulator.builder()
                    .tenantId(tid)
                    .name(summary.getName())
                    .abbreviation(summary.getAbbreviation())
                    .platformRegulatorId(summary.getRegulatorId())
                    .isActive(true)
                    .build());
            }
            if (!allRegs.isEmpty()) {
                p.setSubscribedRegulators(allRegs.stream().map(RegulatorSummary::getRegulatorId).toList());
            }
            log.info("Salvaged {} regulators for tenant {} (existing {} -> now {})", allRegs.size(), tid, existingIds.size(), p.getSubscribedRegulators() != null ? p.getSubscribedRegulators().size() : 0);
        }

        profiles.save(p);

        log.info("Onboarding completed for tenant {}", tenantIdentity.currentTenantId());

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                TenantProfile fresh = profiles.findByTenantId(tenantIdentity.currentTenantId()).orElse(p);
                try { platformApi.clearCache(); } catch (Exception ce) { log.warn("clearCache failed: {}", ce.getMessage()); }
                try {
                    Map<String, Object> tenantReq = new HashMap<>();
                    tenantReq.put("legalName", fresh.getLegalName());
                    tenantReq.put("address", fresh.getAddress());
                    tenantReq.put("contactPhone", fresh.getContactPhone());
                    tenantReq.put("contactEmail", fresh.getContactEmail());
                    tenantReq.put("ccoEmail", fresh.getCcoEmail());
                    tenantReq.put("regulators", fresh.getSubscribedRegulators());
                    tenantReq.put("subscribedDocumentTypes", fresh.getSubscribedDocumentTypes());
                    tenantReq.put("notificationFrequency", fresh.getNotificationFrequency());
                    tenantReq.put("subscriptionTier", fresh.getSubscriptionTier());
                    tenantReq.put("webhookUrl", fresh.getWebhookUrl());
                    platformApi.onboardTenant(tenantReq);
                } catch (Throwable e) {
                    log.error("Failed to onboard tenant on platform for {}: {}", tenantIdentity.currentTenantId(), e.getMessage(), e);
                }
                try {
                    seedService.seedAsync();
                } catch (Exception e) {
                    log.warn("Async seed submit failed: {}", e.getMessage());
                }
            }
        });

        return OnboardingStatusResponse.builder()
            .onboardingCompleted(true).currentStep(6)
            .licenseStatus(p.getLicenseStatus())
            .authType(p.getAuthType())
            .legalName(p.getLegalName())
            .subscribedRegulators(p.getSubscribedRegulators())
            .subscribedDocumentTypes(p.getSubscribedDocumentTypes()).build();
    }

    private TenantProfile getProfile() {
        return tenantIdentity.currentProfile()
            .orElseThrow(() -> new ProfileNotFoundException("Profile not found. Complete step 1 first."));
    }

    private com.atheris.compliance.tenant.backend.modules.license.dto.ActivateLicenseRequest toActivateReq(ActivateLicenseStepRequest req) {
        com.atheris.compliance.tenant.backend.modules.license.dto.ActivateLicenseRequest r =
            new com.atheris.compliance.tenant.backend.modules.license.dto.ActivateLicenseRequest();
        r.setLicenseKey(req.getLicenseKey());
        r.setDeviceFingerprint(req.getDeviceFingerprint());
        r.setDeviceLabel(req.getDeviceLabel());
        return r;
    }
}
