package com.atheris.tenant.modules.license.scheduler;

import com.atheris.tenant.modules.license.service.LicenseService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class LicenseCheckupScheduler {

    private final LicenseService licenseService;

    @PostConstruct
    public void onStartup() {
        log.info("Running license checkup on startup...");
        try {
            var status = licenseService.checkup();
            log.info("Startup checkup: valid={}, status={}", status.isValid(), status.getStatus());
        } catch (Exception e) {
            log.warn("Startup license checkup failed (may be expected before activation): {}", e.getMessage());
        }
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
