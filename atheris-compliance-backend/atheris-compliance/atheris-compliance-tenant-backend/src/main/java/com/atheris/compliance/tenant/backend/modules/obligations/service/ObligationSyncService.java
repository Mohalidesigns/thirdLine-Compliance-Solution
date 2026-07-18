package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.entity.ObligationClassification;
import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationClassificationRepository;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantPollingConfigRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentSummary;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class ObligationSyncService {

    private final PlatformApiClient platformClient;
    private final TenantProfileRepository profiles;
    private final TenantPollingConfigRepository pollingConfigs;
    private final TenantRegulatorRepository tenantRegulators;
    private final ObligationClassificationRepository obligations;

    @PersistenceContext
    private EntityManager em;

    @Value("${atheris.tenant-id:}")
    private Long tenantId;

    @Scheduled(fixedDelayString = "#{@pollingIntervalProvider.intervalMs}")
    @Transactional
    public void pollForNewObligations() {
        TenantProfile p = profiles.findByTenantId(tenantId).orElse(null);
        if (p == null || !Boolean.TRUE.equals(p.getIsActive())) return;

        List<Integer> platformRegulatorIds = tenantRegulators
            .findByTenantIdAndIsActiveTrue(tenantId)
            .stream()
            .map(TenantRegulator::getPlatformRegulatorId)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());

        if (platformRegulatorIds.isEmpty()) return;

        var pollingConfig = pollingConfigs.findByTenantId(tenantId)
            .orElse(null);
        LocalDate since = pollingConfig != null && pollingConfig.getLastPolledAt() != null
            ? pollingConfig.getLastPolledAt().atZone(java.time.ZoneOffset.UTC).toLocalDate() : null;

        try {
            List<PlatformInstrumentSummary> results = platformClient.findRecentInstruments(
                tenantId, platformRegulatorIds, p.getLicenceType(), since);

            for (PlatformInstrumentSummary item : results) {
                if (obligations.findByInstrumentId(item.getInstrumentId()).isPresent())
                    continue;

                ObligationClassification oc = ObligationClassification.builder()
                    .instrumentId(item.getInstrumentId())
                    .applicability("under_review")
                    .tenantRiskRating(item.getRiskRating())
                    .status("unclassified")
                    .build();
                obligations.save(oc);
                log.info("Created local obligation record for instrument {}: {}",
                    item.getInstrumentId(), item.getSourceTitle());
            }

            if (pollingConfig != null) {
                pollingConfig.setLastPolledAt(Instant.now());
                pollingConfigs.save(pollingConfig);
            }
        } catch (Exception e) {
            log.error("Obligation sync failed: {}", e.getMessage(), e);
            em.clear();
        }
    }
}
