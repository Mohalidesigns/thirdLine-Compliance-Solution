package com.atheris.compliance.tenant.backend.modules.obligations.service;

import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.onboarding.entity.TenantProfile;
import com.atheris.compliance.tenant.backend.modules.onboarding.repository.TenantProfileRepository;
import com.atheris.compliance.tenant.backend.modules.review.entity.PendingReview;
import com.atheris.compliance.tenant.backend.modules.review.entity.ReviewObligation;
import com.atheris.compliance.tenant.backend.modules.review.entity.ReviewSanction;
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

        List<Integer> platformRegulatorIds = p.getSubscribedRegulators() != null
            ? p.getSubscribedRegulators().stream().filter(Objects::nonNull).distinct().collect(Collectors.toList())
            : List.of();

        log.info("Sync check: tenant {} has {} intelligence regulatorIds: {}", tenantId, platformRegulatorIds.size(), platformRegulatorIds);
        if (platformRegulatorIds.isEmpty()) {
            log.info("Sync skipped: no intelligence regulators for tenant {}", tenantId);
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
            log.info("Syncing instruments for tenant {} (regulators: count={}, ids={}, since: {})", tenantId, platformRegulatorIds.size(), platformRegulatorIds, since);
            List<PlatformInstrumentSummary> results = platformClient.findRecentInstruments(
                tenantId, platformRegulatorIds, p.getLicenceType(), since);
            if (results == null) {
                log.warn("Sync aborted: platform returned null (error) for tenant {} - watermark NOT advanced (since={})", tenantId, since);
                return;
            }

            log.info("Received {} instruments from platform", results.size());
            int created = 0, inRegister = 0, alreadyQueued = 0, noObligations = 0, toolkit = 0;

            for (PlatformInstrumentSummary item : results) {
                if (com.atheris.compliance.common.Constants.UPLOAD_SOURCE_TOOLKIT.equals(item.getUploadSource())) {
                    toolkit++;
                    continue;
                }
                if (obligationRepository.countByInstrumentId(item.getInstrumentId()) > 0) {
                    inRegister++;
                    continue;
                }
                if (pendingReviews.existsByInstrumentIdAndTenantId(item.getInstrumentId(), tenantId)) {
                    alreadyQueued++;
                    continue;
                }

                PlatformInstrumentDetail detail = platformClient.getInstrumentDetail(item.getInstrumentId());
                if (detail == null || detail.getObligations() == null || detail.getObligations().isEmpty()) {
                    noObligations++;
                    continue;
                }

                List<ReviewObligation> extracted = new ArrayList<>();
                for (var extObl : detail.getObligations()) {
                    extracted.add(ReviewObligation.builder()
                        .obligationNumber(extObl.getObligationNumber())
                        .title(shorten(extObl.getTitle(), 500))
                        .description(extObl.getDescription())
                        .plainEnglishStatement(shorten(extObl.getPlainEnglishStatement(), 500))
                        .sectionReference(shorten(extObl.getSpecificSectionReference(), 100))
                        .areaOfFocus(extObl.getAreaOfFocus())
                        .obligationType(extObl.getObligationType())
                        .recurringDeadlineType(extObl.getRecurringDeadlineType())
                        .riskDescription(extObl.getRiskDescription())
                        .inherentLikelihood(extObl.getInherentLikelihood())
                        .inherentImpact(extObl.getInherentImpact())
                        .inherentRiskRating(extObl.getInherentRiskRating())
                        .controlOwner(shorten(extObl.getControlOwner(), 500))
                        .regulationId(extObl.getRegulationId())
                        .actName(shorten(extObl.getActName(), 500))
                        .applicable(true)
                        .build());
                }

                List<ReviewSanction> extractedSanctions = new ArrayList<>();
                if (detail.getSanctions() != null) {
                    for (var s : detail.getSanctions()) {
                        extractedSanctions.add(ReviewSanction.builder()
                            .sanctionType(s.getSanctionType())
                            .penaltyType(s.getPenaltyType())
                            .amountNaira(s.getAmountNaira())
                            .sanctionAmountPerDay(s.getSanctionAmountPerDay())
                            .personalLiabilityNaira(s.getPersonalLiabilityNaira())
                            .liableRoles(s.getLiableRoles())
                            .severityScore(s.getSeverityScore())
                            .hasBeenEnforced(s.getHasBeenEnforced())
                            .recentEnforcementDate(s.getRecentEnforcementDate())
                            .recentEnforcementAmount(s.getRecentEnforcementAmount())
                            .description(s.getDescription())
                            .sourceSectionReference(s.getSourceSectionReference())
                            .riskExplanation(s.getRiskExplanation())
                            .penaltyDetails(s.getPenaltyDetails())
                            .regulationId(s.getRegulationId())
                            .actName(shorten(s.getActName(), 500))
                            .actAbbreviation(s.getActAbbreviation())
                            .instrumentTitle(s.getInstrumentTitle())
                            .build());
                    }
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
                    .sanctions(extractedSanctions)
                    .status("pending")
                    .build());
                created++;
                log.info("Queued {} obligations for review from instrument {}: {}",
                    extracted.size(), item.getInstrumentId(), detail.getSourceTitle());
            }

            log.info("Sync complete: {} created, {} skipped ({} toolkit, {} already in register, {} already queued, {} without obligations)",
                created, toolkit + inRegister + alreadyQueued + noObligations, toolkit, inRegister, alreadyQueued, noObligations);

            pollingConfig.setLastPolledAt(Instant.now());
            pollingConfigs.save(pollingConfig);
        } catch (Throwable e) {
            log.error("Obligation sync failed: {}", e.getMessage(), e);
            try { em.clear(); } catch (Exception ex) { log.warn("em.clear failed: {}", ex.getMessage()); }
            try {
                org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
            } catch (Exception ex) { /* no transaction */ }
        }
    }

    private static String shorten(String s, int max) {
        if (s == null) return null;
        if (s.length() <= max) return s;
        return s.substring(0, max);
    }
}
