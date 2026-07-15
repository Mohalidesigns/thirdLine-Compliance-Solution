package com.atheris.tenant.modules.onboarding.service;

import com.atheris.tenant.modules.onboarding.dto.*;
import com.atheris.tenant.modules.onboarding.entity.TenantProfile;
import com.atheris.tenant.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.tenant.modules.subscriptions.entity.TenantRegulatorPreference;
import com.atheris.tenant.modules.subscriptions.repository.TenantRegulatorPreferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${atheris.tenant-id:}")
    private String tenantId;

    private static final Map<String, List<String>> RECOMMENDED = Map.of(
        "Commercial Bank", List.of("CBN", "NDIC", "NFIU", "NDPC"),
        "Merchant Bank", List.of("CBN", "NDIC", "NFIU", "NDPC"),
        "Microfinance Bank", List.of("CBN", "NDIC", "NFIU"),
        "Fintech / Payment Service Provider", List.of("CBN", "NFIU", "NDPC", "FCCPC"),
        "Pension Fund Administrator", List.of("PenCom", "NDPC", "FIRS"),
        "Insurance Company", List.of("NAICOM", "NDPC", "FIRS"),
        "Capital Market Dealer", List.of("SEC", "NDPC", "CAC"),
        "Bureau de Change", List.of("CBN", "NFIU", "EFCC")
    );

    public OnboardingStatusResponse getStatus() {
        return profiles.findByTenantId(tenantId)
            .map(p -> OnboardingStatusResponse.builder()
                .onboardingCompleted(p.getOnboardingCompletedAt() != null)
                .currentStep(p.getOnboardingStep())
                .legalName(p.getLegalName()).licenceType(p.getLicenceType())
                .subscribedRegulators(p.getSubscribedRegulators())
                .subscribedDocumentTypes(p.getSubscribedDocumentTypes())
                .build())
            .orElse(OnboardingStatusResponse.builder()
                .onboardingCompleted(false).currentStep(1).build());
    }

    @Transactional
    public OnboardingStatusResponse saveInstitution(InstitutionDetailsRequest req) {
        TenantProfile p = profiles.findByTenantId(tenantId)
            .orElse(TenantProfile.builder().tenantId(tenantId).build());
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
        p.setOnboardingStep(1);
        profiles.save(p);
        List<String> recommended = RECOMMENDED.getOrDefault(req.getLicenceType(), List.of("CBN", "NDPC"));
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(1).nextStep(2)
            .recommendedRegulators(recommended)
            .legalName(req.getLegalName()).licenceType(req.getLicenceType()).build();
    }

    @Transactional
    public OnboardingStatusResponse saveRegulators(RegulatorSubscriptionRequest req) {
        TenantProfile p = getProfile();
        p.setSubscribedRegulators(req.getSubscribedRegulators());
        if (req.getNotificationFrequency() != null)
            p.setNotificationFrequency(req.getNotificationFrequency());
        p.setOnboardingStep(2);
        profiles.save(p);
        if (req.getPerRegulatorOverrides() != null) {
            req.getPerRegulatorOverrides().forEach(o -> {
                String abbr = (String) o.get("regulator_abbr");
                if (abbr == null) return;
                TenantRegulatorPreference pref = regPrefs.findByRegulatorAbbr(abbr)
                    .orElse(TenantRegulatorPreference.builder().regulatorAbbr(abbr).regulatorId(0).build());
                if (o.containsKey("notification_frequency_override"))
                    pref.setNotificationFrequencyOverride((String) o.get("notification_frequency_override"));
                regPrefs.save(pref);
            });
        }
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(2).nextStep(3)
            .subscribedRegulators(req.getSubscribedRegulators()).build();
    }

    @Transactional
    public OnboardingStatusResponse saveDocumentTypes(DocumentTypeRequest req) {
        TenantProfile p = getProfile();
        p.setSubscribedDocumentTypes(req.getSubscribedDocumentTypes());
        p.setNotificationRiskRatings(req.getNotificationRiskRatings());
        p.setOnboardingStep(3);
        profiles.save(p);
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(false).currentStep(3).nextStep(4)
            .subscribedDocumentTypes(req.getSubscribedDocumentTypes()).build();
    }

    @Transactional
    public OnboardingStatusResponse confirm(OnboardingConfirmRequest req) {
        TenantProfile p = getProfile();
        if (req.getWebhookUrl() != null) p.setWebhookUrl(req.getWebhookUrl());
        p.setOnboardingCompletedAt(Instant.now());
        p.setOnboardingStep(4);
        profiles.save(p);
        log.info("Onboarding completed for tenant {}", tenantId);
        return OnboardingStatusResponse.builder()
            .onboardingCompleted(true).currentStep(4)
            .legalName(p.getLegalName())
            .subscribedRegulators(p.getSubscribedRegulators())
            .subscribedDocumentTypes(p.getSubscribedDocumentTypes()).build();
    }

    private TenantProfile getProfile() {
        return profiles.findByTenantId(tenantId)
            .orElseThrow(() -> new RuntimeException("Profile not found. Complete step 1 first."));
    }
}
