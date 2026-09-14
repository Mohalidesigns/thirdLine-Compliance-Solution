package com.atheris.compliance.tenant.backend.modules.onboarding.service;

import com.atheris.compliance.tenant.backend.modules.obligations.repository.ObligationRepository;
import com.atheris.compliance.tenant.backend.modules.obligations.service.ObligationSyncService;
import com.atheris.compliance.tenant.backend.modules.obligations.service.RegulationSeedService;
import com.atheris.compliance.tenant.backend.modules.review.repository.PendingReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service @Slf4j @RequiredArgsConstructor
public class SeedService {

    private final RegulationSeedService regulationSeedService;
    private final ObligationSyncService syncService;
    private final ObligationRepository obligationRepo;
    private final PendingReviewRepository pendingReviewRepo;

    @Async
    public void seedAsync() {
        log.info("[SeedService] Async seed started");
        try {
            int seeded = regulationSeedService.seedAll();
            log.info("[SeedService] seedAll completed: {} seeded", seeded);
        } catch (Exception e) {
            log.error("[SeedService] seedAll failed: {}", e.getMessage(), e);
        }
        try {
            syncService.syncNow();
            log.info("[SeedService] syncNow completed");
        } catch (Exception e) {
            log.error("[SeedService] syncNow failed: {}", e.getMessage(), e);
        }
        log.info("[SeedService] Async seed finished");
    }

    public SeedStatusDto getStatus() {
        long obligationCount = obligationRepo.count();
        long pendingReviewCount = pendingReviewRepo.count();
        return SeedStatusDto.builder()
            .obligationCount(obligationCount)
            .pendingReviewCount(pendingReviewCount)
            .isSeeded(obligationCount > 0)
            .build();
    }

    @lombok.Data @lombok.Builder @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class SeedStatusDto {
        private long obligationCount;
        private long pendingReviewCount;
        private boolean isSeeded;
    }
}
