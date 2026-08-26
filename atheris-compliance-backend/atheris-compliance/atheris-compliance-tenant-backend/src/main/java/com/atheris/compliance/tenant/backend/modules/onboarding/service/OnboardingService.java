package com.atheris.compliance.tenant.backend.modules.onboarding.service;

import com.atheris.compliance.tenant.backend.modules.license.dto.LicenseStatusResponse;
import com.atheris.compliance.tenant.backend.modules.license.exception.LicenseActivationException;
import com.atheris.compliance.tenant.backend.modules.license.exception.ProfileNotFoundException;
import com.atheris.compliance.tenant.backend.modules.license.service.LicenseService;
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
    private final PlatformApiClient platformApi;
    private final ObligationSyncService syncService;
    private final RegulationSeedService regulationSeedService;
    private final TenantIdentityService tenantIdentity;

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
        if (req.getCcoEmail() != null) p.setCcoEmail(req.getCcoEmail());
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

        if ("ldap".equalsIgnoreCase(req.getAuthType())) {
            p.setAuthType("ldap");
            p.setLdapConfig(req.getLdapConfig());
        } else {
            p.setAuthType("local");
            if (req.getLocalAdmin() != null) {
                String email = req.getLocalAdmin().getEmail().toLowerCase().trim();
                if (!users.existsByEmail(email)) {
                    User admin = User.builder()
                        .email(email)
                        .fullName(req.getLocalAdmin().getFullName())
                        .role("TENANT_ADMIN")
                        .passwordHash(passwordEncoder.encode(req.getLocalAdmin().getPassword()))
                        .isActive(true)
                        .emailVerified(true)
                        .inviteStatus("active")
                        .build();
                    users.save(admin);
                    log.info("Admin user created during onboarding: {}", email);
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

    @Transactional
    public OnboardingStatusResponse saveRegulators(RegulatorSubscriptionRequest req) {
        TenantProfile p = getProfile();
        p.setSubscribedRegulators(req.getSubscribedRegulators());
        p.setOnboardingStep(4);
        profiles.save(p);

        if (req.getPerRegulatorOverrides() != null) {
            req.getPerRegulatorOverrides().forEach(o -> {
                Integer id = (Integer) o.get("regulator_id");
                if (id == null) return;
                TenantRegulatorPreference pref = regPrefs.findByRegulatorId(id)
                    .orElse(TenantRegulatorPreference.builder().regulatorId(id).build());
                if (o.containsKey("notification_frequency_override"))
                    pref.setNotificationFrequencyOverride((String) o.get("notification_frequency_override"));
                regPrefs.save(pref);
            });
        }

        List<RegulatorSummary> allRegs = platformApi.fetchRegulators();
        Long tid = tenantIdentity.currentTenantId();
        List<TenantRegulator> existing = tenantRegulatorRepo.findByTenantIdAndIsActiveTrue(tid);

        if (req.getSubscribedRegulators() != null) {
            for (Integer regId : req.getSubscribedRegulators()) {
                boolean alreadyExists = existing.stream()
                    .anyMatch(e -> regId.equals(e.getPlatformRegulatorId()));
                if (alreadyExists) continue;
                RegulatorSummary summary = allRegs.stream()
                    .filter(r -> regId.equals(r.getRegulatorId()))
                    .findFirst().orElse(null);
                if (summary != null) {
                    tenantRegulatorRepo.save(TenantRegulator.builder()
                        .tenantId(tid)
                        .name(summary.getName())
                        .abbreviation(summary.getAbbreviation())
                        .platformRegulatorId(summary.getRegulatorId())
                        .isActive(true)
                        .build());
                } else {
                    log.warn("Regulator {} not found on platform, creating with fallback name", regId);
                    tenantRegulatorRepo.save(TenantRegulator.builder()
                        .tenantId(tid)
                        .name("Regulator " + regId)
                        .platformRegulatorId(regId)
                        .isActive(true)
                        .build());
                }
            }
        }

        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(4).nextStep(5)
            .licenseStatus(p.getLicenseStatus())
            .subscribedRegulators(req.getSubscribedRegulators()).build();
    }

    @Transactional
    public OnboardingStatusResponse saveDocumentTypes(DocumentTypeRequest req) {
        TenantProfile p = getProfile();
        p.setSubscribedDocumentTypes(req.getSubscribedDocumentTypes());
        p.setNotificationRiskRatings(req.getNotificationRiskRatings());
        p.setOnboardingStep(5);
        profiles.save(p);
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(5).nextStep(6)
            .licenseStatus(p.getLicenseStatus())
            .subscribedDocumentTypes(req.getSubscribedDocumentTypes()).build();
    }

    @Transactional
    public OnboardingStatusResponse confirm(OnboardingConfirmRequest req) {
        TenantProfile p = getProfile();
        if (req.getWebhookUrl() != null) p.setWebhookUrl(req.getWebhookUrl());
        p.setIsActive(true);
        p.setOnboardingCompletedAt(Instant.now());
        p.setOnboardingStep(6);
        profiles.save(p);

        log.info("Onboarding completed for tenant {}", tenantIdentity.currentTenantId());

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {
                    Map<String, Object> tenantReq = new HashMap<>();
                    tenantReq.put("legalName", p.getLegalName());
                    tenantReq.put("address", p.getAddress());
                    tenantReq.put("contactPhone", p.getContactPhone());
                    tenantReq.put("contactEmail", p.getContactEmail());
                    tenantReq.put("ccoEmail", p.getCcoEmail());
                    tenantReq.put("regulators", p.getSubscribedRegulators());
                    tenantReq.put("subscribedDocumentTypes", p.getSubscribedDocumentTypes());
                    tenantReq.put("notificationFrequency", p.getNotificationFrequency());
                    tenantReq.put("subscriptionTier", p.getSubscriptionTier());
                    tenantReq.put("webhookUrl", p.getWebhookUrl());
                    platformApi.onboardTenant(tenantReq);
                } catch (Exception e) {
                    log.error("Failed to create tenant on platform for {}", tenantIdentity.currentTenantId(), e.getMessage());
                }
                try { regulationSeedService.seedAll(); } catch (Exception e) {
                    log.warn("Regulation seed failed: {}", e.getMessage());
                }
                try { syncService.syncNow(); } catch (Exception e) {
                    log.warn("Initial sync failed: {}", e.getMessage());
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
