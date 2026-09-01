package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.modules.review.entity.PendingReview;
import com.atheris.compliance.tenant.backend.modules.review.entity.ReviewObligation;
import com.atheris.compliance.tenant.backend.modules.review.repository.PendingReviewRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantRegulator;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantPollingConfigRepository;
import com.atheris.compliance.tenant.backend.modules.subscriptions.repository.TenantRegulatorRepository;
import com.atheris.compliance.tenant.backend.shared.platform.client.PlatformApiClient;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentDetail;
import com.atheris.compliance.tenant.backend.shared.platform.dto.PlatformInstrumentSummary;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service @Slf4j @RequiredArgsConstructor
public class ObligationSyncService {

    private final PlatformApiClient platformClient;
    private final TenantProfileRepository profiles;
    private final TenantPollingConfigRepository pollingConfigs;
    private final TenantRegulatorRepository tenantRegulators;
    private final ObligationRepository obligationRepository;
    private final PendingReviewRepository pendingReviews;
    private final TenantIdentityService tenantIdentity;

    @PersistenceContext
    private EntityManager em;

    @EventListener(ApplicationReadyEvent.class)
    public void syncOnStartup() {
        new Thread(() -> {
            try { Thread.sleep(3000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            log.info("Running initial sync on startup...");
            try { syncNow(); } catch (Exception e) {
                log.warn("Startup sync failed: {}", e.getMessage());
            }
        }).start();
    }

    @Scheduled(fixedDelayString = "#{@pollingIntervalProvider.intervalMs}")
    @Transactional
    public void pollForNewObligations() {
        syncNow();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void syncNow() {
        Long tenantId = tenantIdentity.currentTenantId();
        TenantProfile p = profiles.findByTenantId(tenantId).orElse(null);
        if (p == null || !Boolean.TRUE.equals(p.getIsActive())) {
            log.info("Sync skipped: tenant {} not found or inactive", tenantId);
            return;
        }

        List<Integer> platformRegulatorIds = tenantRegulators
            .findByTenantIdAndIsActiveTrue(tenantId)
            .stream()
            .map(TenantRegulator::getPlatformRegulatorId)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());

        if (platformRegulatorIds.isEmpty()) {
            log.info("Sync skipped: no active regulators for tenant {}", tenantId);
            return;
        }

        var pollingConfig = pollingConfigs.findByTenantId(tenantId)
            .orElse(null);
        if (pollingConfig == null) {
            pollingConfig = com.atheris.compliance.tenant.backend.modules.subscriptions.entity.TenantPollingConfig.builder()
                .tenantId(tenantId)
                .pollingIntervalMinutes(15)
                .build();
            pollingConfigs.save(pollingConfig);
        }
        LocalDate since = pollingConfig.getLastPolledAt() != null
            ? pollingConfig.getLastPolledAt().atZone(java.time.ZoneOffset.UTC).toLocalDate() : null;

        try {
            log.info("Syncing instruments for tenant {} (regulators: {}, since: {})", tenantId, platformRegulatorIds, since);
            List<PlatformInstrumentSummary> results = platformClient.findRecentInstruments(
                tenantId, platformRegulatorIds, p.getLicenceType(), since);

            log.info("Received {} instruments from platform", results.size());
            int created = 0, skipped = 0;

            for (PlatformInstrumentSummary item : results) {
                if (obligationRepository.countByInstrumentId(item.getInstrumentId()) > 0) {
                    skipped++;
                    continue;
                }
                if (pendingReviews.existsByInstrumentIdAndTenantId(item.getInstrumentId(), tenantId)) {
                    skipped++;
                    continue;
                }

                PlatformInstrumentDetail detail = platformClient.getInstrumentDetail(item.getInstrumentId());
                if (detail == null || detail.getObligations() == null || detail.getObligations().isEmpty()) {
                    skipped++;
                    continue;
                }

                List<ReviewObligation> extracted = new ArrayList<>();
                for (var extObl : detail.getObligations()) {
                    extracted.add(ReviewObligation.builder()
                        .obligationNumber(extObl.getObligationNumber())
                        .description(extObl.getPlainEnglishStatement())
                        .sectionReference(extObl.getSpecificSectionReference())
                        .areaOfFocus(extObl.getAreaOfFocus())
                        .obligationType(extObl.getObligationType())
                        .recurringDeadlineType(extObl.getRecurringDeadlineType())
                        .applicable(true)
                        .build());
                }

                LocalDate effDate = detail.getDateCommencement() != null ? detail.getDateCommencement() : detail.getDateIssued();
                pendingReviews.save(PendingReview.builder()
                    .tenantId(tenantId)
                    .source("intel")
                    .instrumentId(item.getInstrumentId())
                    .sourceTitle(detail.getSourceTitle())
                    .sourceReferenceNumber(detail.getSourceReferenceNumber())
                    .regulatorId(detail.getRegulatorId())
                    .regulatorName(detail.getRegulatorName())
                    .regulatorAbbreviation(detail.getRegulatorAbbreviation())
                    .documentType(detail.getNature())
                    .riskRating(detail.getRiskRating())
                    .dateIssued(detail.getDateIssued())
                    .effectiveDate(effDate)
                    .publishedAt(detail.getPublishedAt())
                    .pdfUrl(detail.getPdfUrl())
                    .obligations(extracted)
                    .status("pending")
                    .build());
                created++;
                log.info("Queued {} obligations for review from instrument {}: {}",
                    extracted.size(), item.getInstrumentId(), detail.getSourceTitle());
            }

            log.info("Sync complete: {} created, {} skipped (already exist)", created, skipped);

            pollingConfig.setLastPolledAt(Instant.now());
            pollingConfigs.save(pollingConfig);
        } catch (Exception e) {
            log.error("Obligation sync failed: {}", e.getMessage(), e);
            em.clear();
        }
    }
}
