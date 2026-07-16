package com.atheris.tenant.modules.onboarding.service;

import com.atheris.tenant.modules.license.dto.LicenseStatusResponse;
import com.atheris.tenant.modules.license.exception.LicenseActivationException;
import com.atheris.tenant.modules.license.exception.ProfileNotFoundException;
import com.atheris.tenant.modules.license.service.LicenseService;
import com.atheris.tenant.modules.onboarding.dto.*;
import com.atheris.tenant.modules.onboarding.entity.TenantProfile;
import com.atheris.tenant.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.tenant.modules.subscriptions.entity.TenantRegulatorPreference;
import com.atheris.tenant.modules.subscriptions.repository.TenantRegulatorPreferenceRepository;
import com.atheris.tenant.modules.users.entity.User;
import com.atheris.tenant.modules.users.repository.UserRepository;
import static com.atheris.common.Constants.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class OnboardingService {

    private final TenantProfileRepository profiles;
    private final TenantRegulatorPreferenceRepository regPrefs;
    private final RegulatorRecommendationService recommendationService;
    private final LicenseService licenseService;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    public OnboardingStatusResponse getStatus() {
        return profiles.findByTenantId(tenantId)
            .map(p -> {
                Integer step = p.getOnboardingStep();
                boolean completed = p.getOnboardingCompletedAt() != null;
                boolean enabled = Boolean.TRUE.equals(p.getIntelligenceEnabled());
                Integer nextStep = computeNextStep(step, completed, enabled);
                return OnboardingStatusResponse.builder()
                    .onboardingCompleted(completed)
                    .currentStep(step)
                    .nextStep(nextStep)
                    .legalName(p.getLegalName()).licenceType(p.getLicenceType())
                    .intelligenceEnabled(p.getIntelligenceEnabled())
                    .licenseStatus(p.getLicenseStatus())
                    .authType(p.getAuthType())
                    .subscribedRegulators(p.getSubscribedRegulators())
                    .subscribedDocumentTypes(p.getSubscribedDocumentTypes())
                    .build();
            })
            .orElse(OnboardingStatusResponse.builder()
                .onboardingCompleted(false).currentStep(0).nextStep(1).build());
    }

    private Integer computeNextStep(Integer step, boolean completed, boolean intelligenceEnabled) {
        if (completed) return 7;
        if (step == null || step == 0) return 1;
        if (step == 1) return 2;
        if (step == 2) return 3;
        if (step == 3) return 4;
        if (step == 4) return intelligenceEnabled ? 5 : 7;
        if (step == 5) return 6;
        return 7;
    }

    @Transactional
    public OnboardingStatusResponse activateLicense(ActivateLicenseStepRequest req) {
        TenantProfile p = profiles.findByTenantId(tenantId)
            .orElse(TenantProfile.builder().tenantId(tenantId).build());

        LicenseStatusResponse licenseResp = licenseService.activate(
            toActivateReq(req), null, null);

        if (!licenseResp.isValid()) {
            throw new LicenseActivationException(licenseResp.getMessage());
        }

        p.setLicenseKey(req.getLicenseKey());
        p.setLicenseStatus(LICENSE_ACTIVE);
        p.setLicenseActivatedAt(Instant.now());
        if (req.getDeviceFingerprint() != null) {
            p.setDeviceFingerprint(req.getDeviceFingerprint());
            p.setDeviceFingerprintProvisionedAt(Instant.now());
        }
        p.setIntelligenceEnabled(licenseResp.getIntelligenceEnabled() != null
            ? licenseResp.getIntelligenceEnabled() : true);
        p.setOnboardingStep(1);
        profiles.save(p);

        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(1).nextStep(2)
            .licenseStatus(LICENSE_ACTIVE).intelligenceEnabled(p.getIntelligenceEnabled())
            .build();
    }

    @Transactional
    public OnboardingStatusResponse saveInstitution(InstitutionDetailsRequest req) {
        TenantProfile p = getProfile();
        p.setLegalName(req.getLegalName());
        p.setShortName(req.getShortName());
        p.setLicenceType(req.getLicenceType());
        p.setLicenceNumber(req.getLicenceNumber());
        p.setStateOfHq(req.getStateOfHq());
        p.setEmployeeCount(req.getEmployeeCount());
        p.setProductLines(req.getProductLines());
        p.setCcoName(req.getCcoName());
        p.setCcoEmail(req.getCcoEmail());
        p.setTechEmail(req.getTechEmail());
        p.setOnboardingStep(2);
        profiles.save(p);
        List<Integer> recommended = recommendationService.getRecommendedRegulatorIds(req.getLicenceType());
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(2).nextStep(3)
            .recommendedRegulators(recommended)
            .intelligenceEnabled(p.getIntelligenceEnabled())
            .licenseStatus(p.getLicenseStatus())
            .legalName(req.getLegalName()).licenceType(req.getLicenceType()).build();
    }

    @Transactional
    public OnboardingStatusResponse saveIntelligenceMode(IntelligenceModeRequest req) {
        TenantProfile p = getProfile();
        boolean enabled = req.getIntelligenceEnabled() != null ? req.getIntelligenceEnabled() : true;
        p.setIntelligenceEnabled(enabled);
        p.setOnboardingStep(3);
        profiles.save(p);
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(3).nextStep(4)
            .intelligenceEnabled(enabled)
            .licenseStatus(p.getLicenseStatus())
            .legalName(p.getLegalName()).licenceType(p.getLicenceType()).build();
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

        boolean enabled = Boolean.TRUE.equals(p.getIntelligenceEnabled());
        p.setOnboardingStep(4);
        profiles.save(p);
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(4).nextStep(enabled ? 5 : 7)
            .authType(p.getAuthType())
            .intelligenceEnabled(p.getIntelligenceEnabled())
            .licenseStatus(p.getLicenseStatus())
            .legalName(p.getLegalName()).licenceType(p.getLicenceType()).build();
    }

    @Transactional
    public OnboardingStatusResponse saveRegulators(RegulatorSubscriptionRequest req) {
        TenantProfile p = getProfile();
        if (Boolean.FALSE.equals(p.getIntelligenceEnabled())) {
            return OnboardingStatusResponse.builder()
                .onboardingCompleted(false).currentStep(4).nextStep(7)
                .intelligenceEnabled(false)
                .licenseStatus(p.getLicenseStatus()).build();
        }
        p.setSubscribedRegulators(req.getSubscribedRegulators());
        if (req.getNotificationFrequency() != null)
            p.setNotificationFrequency(req.getNotificationFrequency());
        p.setOnboardingStep(5);
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
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(5).nextStep(6)
            .intelligenceEnabled(p.getIntelligenceEnabled())
            .licenseStatus(p.getLicenseStatus())
            .subscribedRegulators(req.getSubscribedRegulators()).build();
    }

    @Transactional
    public OnboardingStatusResponse saveDocumentTypes(DocumentTypeRequest req) {
        TenantProfile p = getProfile();
        if (Boolean.FALSE.equals(p.getIntelligenceEnabled())) {
            return OnboardingStatusResponse.builder()
                .onboardingCompleted(false).currentStep(4).nextStep(7)
                .intelligenceEnabled(false)
                .licenseStatus(p.getLicenseStatus()).build();
        }
        p.setSubscribedDocumentTypes(req.getSubscribedDocumentTypes());
        p.setNotificationRiskRatings(req.getNotificationRiskRatings());
        p.setOnboardingStep(6);
        profiles.save(p);
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(6).nextStep(7)
            .intelligenceEnabled(p.getIntelligenceEnabled())
            .licenseStatus(p.getLicenseStatus())
            .subscribedDocumentTypes(req.getSubscribedDocumentTypes()).build();
    }

    @Transactional
    public OnboardingStatusResponse confirm(OnboardingConfirmRequest req) {
        TenantProfile p = getProfile();
        if (req.getWebhookUrl() != null) p.setWebhookUrl(req.getWebhookUrl());
        p.setOnboardingCompletedAt(Instant.now());
        p.setOnboardingStep(7);
        profiles.save(p);
        log.info("Onboarding completed for tenant {}", tenantId);
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(true).currentStep(7)
            .intelligenceEnabled(p.getIntelligenceEnabled())
            .licenseStatus(p.getLicenseStatus())
            .authType(p.getAuthType())
            .legalName(p.getLegalName())
            .subscribedRegulators(p.getSubscribedRegulators())
            .subscribedDocumentTypes(p.getSubscribedDocumentTypes()).build();
    }

    private TenantProfile getProfile() {
        return profiles.findByTenantId(tenantId)
            .orElseThrow(() -> new ProfileNotFoundException("Profile not found. Complete step 1 first."));
    }

    private com.atheris.tenant.modules.license.dto.ActivateLicenseRequest toActivateReq(ActivateLicenseStepRequest req) {
        com.atheris.tenant.modules.license.dto.ActivateLicenseRequest r =
            new com.atheris.tenant.modules.license.dto.ActivateLicenseRequest();
        r.setLicenseKey(req.getLicenseKey());
        r.setDeviceFingerprint(req.getDeviceFingerprint());
        r.setDeviceLabel(req.getDeviceLabel());
        return r;
    }
}
