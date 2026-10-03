package com.atheris.compliance.intelligence.backend.modules.regulations.scheduler;

import com.atheris.compliance.intelligence.backend.modules.regulations.service.ToolkitImportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component @Slf4j @RequiredArgsConstructor
public class PointsRetryScheduler {

    private final ToolkitImportService toolkitImportService;

    @Scheduled(fixedDelayString = "${atheris.points.retry-interval-ms:1800000}")
    public void retryFailedPoints() {
        log.info("[PointsRetry] Checking for obligations with empty points...");
        toolkitImportService.generatePointsForToolkit();
    }
}
