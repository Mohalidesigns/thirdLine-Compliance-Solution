package com.atheris.compliance.tenant.backend.modules.license.scheduler;

import com.atheris.compliance.tenant.backend.modules.license.service.LicenseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class LicenseCheckupScheduler {

    private final LicenseService licenseService;

    private static final int MAX_STARTUP_ATTEMPTS = 15;
    private final java.util.concurrent.atomic.AtomicBoolean startupDone = new java.util.concurrent.atomic.AtomicBoolean(false);
    private final java.util.concurrent.atomic.AtomicInteger startupAttempts = new java.util.concurrent.atomic.AtomicInteger();

    /**
     * Startup checkup, retried every minute while the platform is unreachable (it often starts after
     * this backend) — a single attempt at boot used to fail with "Connection refused" and nothing
     * retried until the next day.
     */
    @Scheduled(initialDelay = 15_000, fixedDelay = 60_000)
    public void startupCheckup() {
        if (startupDone.get()) return;
        int attempt = startupAttempts.incrementAndGet();
        try {
            var status = licenseService.checkup();
            if (com.atheris.compliance.common.Constants.LICENSE_VALIDATION_ERROR.equals(status.getStatus())
                    && attempt < MAX_STARTUP_ATTEMPTS) {
                log.info("Startup license checkup: platform not reachable yet (attempt {}), retrying in 1 minute", attempt);
                return;
            }
            log.info("Startup checkup: valid={}, status={}", status.isValid(), status.getStatus());
        } catch (Exception e) {
            if (attempt < MAX_STARTUP_ATTEMPTS) {
                log.info("Startup license checkup failed (attempt {}): {} — retrying", attempt, e.getMessage());
                return;
            }
            log.warn("Startup license checkup failed (may be expected before activation): {}", e.getMessage());
        }
        startupDone.set(true);
    }

    @Scheduled(fixedRate = 86400000)
    public void dailyCheckup() {
        log.info("Running daily license checkup...");
        try {
            var status = licenseService.checkup();
            log.info("Daily checkup: valid={}, status={}", status.isValid(), status.getStatus());
            if (!status.isValid()) {
                log.warn("License checkup failed: {}", status.getMessage());
            }
        } catch (Exception e) {
            log.error("Daily license checkup failed: {}", e.getMessage());
        }
    }
}
