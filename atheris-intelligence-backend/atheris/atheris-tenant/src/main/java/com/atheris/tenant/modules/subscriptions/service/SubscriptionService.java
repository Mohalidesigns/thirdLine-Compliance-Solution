package com.atheris.tenant.modules.subscriptions.service;

import com.atheris.tenant.modules.audit.service.AuditService;
import com.atheris.tenant.modules.onboarding.entity.TenantProfile;
import com.atheris.tenant.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.tenant.modules.subscriptions.entity.TenantRegulatorPreference;
import com.atheris.tenant.modules.subscriptions.repository.TenantRegulatorPreferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class SubscriptionService {

    private final TenantProfileRepository profiles;
    private final TenantRegulatorPreferenceRepository regPrefs;
    private final AuditService audit;

    @Value("${atheris.tenant-id:}")
    private String tenantId;

    public Map<String, Object> getSummary() {
        TenantProfile p = getProfile();
        return Map.of(
            "subscribed_regulators", p.getSubscribedRegulators() != null ? p.getSubscribedRegulators() : List.of(),
            "subscribed_document_types", p.getSubscribedDocumentTypes() != null ? p.getSubscribedDocumentTypes() : List.of(),
            "notification_risk_ratings", p.getNotificationRiskRatings() != null ? p.getNotificationRiskRatings() : List.of(),
            "notification_frequency", p.getNotificationFrequency(),
            "per_regulator_overrides", regPrefs.findAll()
        );
    }

    @Transactional
    public Map<String, Object> updateRegulators(List<String> regulators, Integer userId) {
        TenantProfile p = getProfile();
        List<String> old = p.getSubscribedRegulators() != null ? p.getSubscribedRegulators() : List.of();
        List<String> added = regulators.stream().filter(r -> !old.contains(r)).toList();
        List<String> removed = old.stream().filter(r -> !regulators.contains(r)).toList();
        p.setSubscribedRegulators(regulators);
        profiles.save(p);
        audit.log(userId, "subscriptions_updated", "tenant_profile", null, Map.of("added", added, "removed", removed));
        return Map.of("subscribed_regulators", regulators, "added", added, "removed", removed);
    }

    @Transactional
    public Map<String, Object> addRegulator(String abbr, Integer userId) {
        TenantProfile p = getProfile();
        List<String> current = new ArrayList<>(p.getSubscribedRegulators() != null ? p.getSubscribedRegulators() : List.of());
        if (!current.contains(abbr)) {
            current.add(abbr);
            p.setSubscribedRegulators(current);
            profiles.save(p);
        }
        if (!regPrefs.existsByRegulatorAbbr(abbr))
            regPrefs.save(TenantRegulatorPreference.builder().regulatorAbbr(abbr).regulatorId(0).isSubscribed(true).updatedByUserId(userId).build());
        else
            regPrefs.setSubscribed(abbr, true);
        audit.log(userId, "regulator_added", "subscription", null, Map.of("regulator", abbr));
        return Map.of("regulator_abbr", abbr, "subscribed", true);
    }

    @Transactional
    public void removeRegulator(String abbr, Integer userId) {
        TenantProfile p = getProfile();
        if (p.getSubscribedRegulators() != null) {
            List<String> updated = new ArrayList<>(p.getSubscribedRegulators());
            updated.remove(abbr);
            p.setSubscribedRegulators(updated);
            profiles.save(p);
        }
        regPrefs.setSubscribed(abbr, false);
        audit.log(userId, "regulator_removed", "subscription", null, Map.of("regulator", abbr));
    }

    @Transactional
    public Map<String, Object> updateRegulatorPreferences(String abbr, String freq, List<String> docTypes, Integer userId) {
        TenantRegulatorPreference pref = regPrefs.findByRegulatorAbbr(abbr)
            .orElse(TenantRegulatorPreference.builder().regulatorAbbr(abbr).regulatorId(0).isSubscribed(true).build());
        if (freq != null) pref.setNotificationFrequencyOverride(freq);
        if (docTypes != null) pref.setDocumentTypesOverride(docTypes);
        pref.setUpdatedByUserId(userId);
        regPrefs.save(pref);
        audit.log(userId, "regulator_preferences_updated", "subscription", null, Map.of("regulator", abbr));
        return Map.of("regulator_abbr", abbr,
            "notification_frequency_override", freq != null ? freq : "",
            "document_types_override", docTypes != null ? docTypes : List.of());
    }

    @Transactional
    public void resetRegulatorPreferences(String abbr) {
        regPrefs.findByRegulatorAbbr(abbr).ifPresent(p -> {
            p.setNotificationFrequencyOverride(null);
            p.setDocumentTypesOverride(null);
            regPrefs.save(p);
        });
    }

    @Transactional
    public void updateDocumentTypes(List<String> docTypes, List<String> riskRatings, Integer userId) {
        TenantProfile p = getProfile();
        if (docTypes != null) p.setSubscribedDocumentTypes(docTypes);
        if (riskRatings != null) p.setNotificationRiskRatings(riskRatings);
        profiles.save(p);
        audit.log(userId, "document_types_updated", "subscription", null, Map.of());
    }

    @Transactional
    public void updateNotificationFrequency(String freq, Integer userId) {
        TenantProfile p = getProfile();
        p.setNotificationFrequency(freq);
        profiles.save(p);
        audit.log(userId, "notification_frequency_updated", "subscription", null, Map.of("frequency", freq));
    }

    private TenantProfile getProfile() {
        return profiles.findByTenantId(tenantId)
            .orElseThrow(() -> new RuntimeException("Tenant profile not found"));
    }
}
