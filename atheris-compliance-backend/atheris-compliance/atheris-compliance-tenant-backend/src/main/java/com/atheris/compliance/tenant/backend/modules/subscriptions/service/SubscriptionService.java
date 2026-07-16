package com.atheris.compliance.tenant.backend.modules.subscriptions.service;

import com.atheris.compliance.tenant.backend.modules.audit.service.AuditService;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulatorPreference;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorPreferenceRepository;
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
    private Long tenantId;

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
    public Map<String, Object> updateRegulators(List<Integer> regulators, Integer userId) {
        TenantProfile p = getProfile();
        List<Integer> old = p.getSubscribedRegulators() != null ? p.getSubscribedRegulators() : List.of();
        List<Integer> added = regulators.stream().filter(r -> !old.contains(r)).toList();
        List<Integer> removed = old.stream().filter(r -> !regulators.contains(r)).toList();
        p.setSubscribedRegulators(regulators);
        profiles.save(p);
        audit.log(userId, "subscriptions_updated", "tenant_profile", null, Map.of("added", added, "removed", removed));
        return Map.of("subscribed_regulators", regulators, "added", added, "removed", removed);
    }

    @Transactional
    public Map<String, Object> addRegulator(Integer regulatorId, Integer userId) {
        TenantProfile p = getProfile();
        List<Integer> current = new ArrayList<>(p.getSubscribedRegulators() != null ? p.getSubscribedRegulators() : List.of());
        if (!current.contains(regulatorId)) {
            current.add(regulatorId);
            p.setSubscribedRegulators(current);
            profiles.save(p);
        }
        if (!regPrefs.existsByRegulatorId(regulatorId))
            regPrefs.save(TenantRegulatorPreference.builder().regulatorId(regulatorId).isSubscribed(true).updatedByUserId(userId).build());
        else
            regPrefs.findByRegulatorId(regulatorId).ifPresent(pref -> {
                pref.setIsSubscribed(true);
                pref.setUpdatedByUserId(userId);
                regPrefs.save(pref);
            });
        audit.log(userId, "regulator_added", "subscription", null, Map.of("regulator_id", regulatorId));
        return Map.of("regulator_id", regulatorId, "subscribed", true);
    }

    @Transactional
    public void removeRegulator(Integer regulatorId, Integer userId) {
        TenantProfile p = getProfile();
        if (p.getSubscribedRegulators() != null) {
            List<Integer> updated = new ArrayList<>(p.getSubscribedRegulators());
            updated.remove(regulatorId);
            p.setSubscribedRegulators(updated);
            profiles.save(p);
        }
        regPrefs.findByRegulatorId(regulatorId).ifPresent(pref -> {
            pref.setIsSubscribed(false);
            pref.setUpdatedByUserId(userId);
            regPrefs.save(pref);
        });
        audit.log(userId, "regulator_removed", "subscription", null, Map.of("regulator_id", regulatorId));
    }

    @Transactional
    public Map<String, Object> updateRegulatorPreferences(Integer regulatorId, String freq, List<String> docTypes, Integer userId) {
        TenantRegulatorPreference pref = regPrefs.findByRegulatorId(regulatorId)
            .orElse(TenantRegulatorPreference.builder().regulatorId(regulatorId).isSubscribed(true).build());
        if (freq != null) pref.setNotificationFrequencyOverride(freq);
        if (docTypes != null) pref.setDocumentTypesOverride(docTypes);
        pref.setUpdatedByUserId(userId);
        regPrefs.save(pref);
        audit.log(userId, "regulator_preferences_updated", "subscription", null, Map.of("regulator_id", regulatorId));
        return Map.of("regulator_id", regulatorId,
            "notification_frequency_override", freq != null ? freq : "",
            "document_types_override", docTypes != null ? docTypes : List.of());
    }

    @Transactional
    public void resetRegulatorPreferences(Integer regulatorId) {
        regPrefs.findByRegulatorId(regulatorId).ifPresent(p -> {
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
